import React, {
    MutableRefObject,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import { Box, Button, Grid, Typography, alpha } from "@mui/material";
import {
    CMSAnalyticsEvent,
    Entity,
    EntityCollection,
    EntityStatus,
    EntityValues,
    PluginFormActionProps,
    FormContext,
    PropertyFieldBindingProps,
    ResolvedEntityCollection,
    ResolvedProperty
} from "../types";
import { Form, Formik, FormikHelpers, FormikProps } from "formik";
import { PropertyFieldBinding } from "./PropertyFieldBinding";
import { CustomFieldValidator, getYupEntitySchema } from "./validation";
import equal from "react-fast-compare"
import {
    CustomDialogActions,
    getDefaultValuesFor,
    isHidden,
    isReadOnly,
    resolveCollection
} from "../core";
import { useDataSource, useFireCMSContext } from "../hooks";
import { ErrorFocus } from "./components/ErrorFocus";
import { CustomIdField } from "./components/CustomIdField";
import { FormController } from "../types/form";
import { useTranslation } from "react-i18next";

/**
 * @category Components
 */
export interface EntityFormProps<M extends Record<string, any>> {

    /**
     * New or existing status
     */
    status: EntityStatus;

    /**
     * Path of the collection this entity is located
     */
    path: string;

    /**
     * The collection is used to build the fields of the form
     */
    collection: EntityCollection<M>

    /**
     * The updated entity is passed from the parent component when the underlying data
     * has changed in the datasource
     */
    entity?: Entity<M>;

    /**
     * The callback function called when Save is clicked and validation is correct
     */
    onEntitySave?: (
        props:
            {
                collection: ResolvedEntityCollection<M>,
                path: string,
                entityId: string | undefined,
                values: EntityValues<M>,
                previousValues?: EntityValues<M>,
                closeAfterSave: boolean
            }
    ) => Promise<void>;

    /**
     * The callback function called when discard is clicked
     */
    onDiscard?: () => void;

    /**
     * The callback function when the form is dirty, so the values are different
     * from the original ones
     */
    onModified?: (dirty: boolean) => void;

    /**
     * The callback function when the form original values have been modified
     */
    onValuesChanged?: (values?: EntityValues<M>) => void;

    /**
     *
     * @param id
     */
    onIdChange?: (id: string) => void;

    currentEntityId?: string;

    onFormControllerChange?: (formController: FormController<M>) => void;

    hideId?: boolean;

}

/**
 * This is the form used internally by the CMS
 * @param status
 * @param path
 * @param collection
 * @param entity
 * @param onEntitySave
 * @param onDiscard
 * @param onModified
 * @param onValuesChanged
 * @constructor
 * @category Components
 */
export const EntityForm = React.memo<EntityFormProps<any>>(EntityFormInternal,
    (a: EntityFormProps<any>, b: EntityFormProps<any>) => {
        return a.status === b.status &&
            a.path === b.path &&
            equal(a.entity?.values, b.entity?.values);
    }) as typeof EntityFormInternal;

function EntityFormInternal<M extends Record<string, any>>({
                                                               status,
                                                               path,
                                                               collection: inputCollection,
                                                               entity,
                                                               onEntitySave,
                                                               onDiscard,
                                                               onModified,
                                                               onValuesChanged,
                                                               onIdChange,
                                                               onFormControllerChange,
                                                               hideId
                                                           }: EntityFormProps<M>) {

    const context = useFireCMSContext();
    const dataSource = useDataSource();
    const plugins = context.plugins;

    const initialResolvedCollection = useMemo(() => resolveCollection({
        collection: inputCollection,
        path,
        values: entity?.values,
        fields: context.fields
    }), [context.fields, entity?.values, inputCollection, path]);

    const mustSetCustomId: boolean = (status === "new" || status === "copy") &&
        (Boolean(initialResolvedCollection.customId) && initialResolvedCollection.customId !== "optional");

    const initialEntityId = useMemo(() => {
        if (status === "new" || status === "copy") {
            if (mustSetCustomId) {
                return undefined;
            } else {
                return dataSource.generateEntityId(path);
            }
        } else {
            return entity?.id;
        }
    }, []);

    const closeAfterSaveRef = useRef(false);

    const baseDataSourceValues: Partial<EntityValues<M>> = useMemo(() => {
        const properties = initialResolvedCollection.properties;
        if ((status === "existing" || status === "copy") && entity) {
            return entity.values ?? getDefaultValuesFor(properties);
        } else if (status === "new") {
            return getDefaultValuesFor(properties);
        } else {
            console.error({
                status,
                entity
            });
            throw new Error("Form has not been initialised with the correct parameters");
        }
    }, [status, initialResolvedCollection, entity]);

    const [entityId, setEntityId] = React.useState<string | undefined>(initialEntityId);
    const [entityIdError, setEntityIdError] = React.useState<boolean>(false);
    const [savingError, setSavingError] = React.useState<Error | undefined>();

    const [initialValues, setInitialValues] = useState<EntityValues<M>>(entity?.values ?? baseDataSourceValues as EntityValues<M>);
    const [internalValues, setInternalValues] = useState<EntityValues<M> | undefined>(initialValues);

    const doOnValuesChanges = useCallback((values?: EntityValues<M>) => {
        setInternalValues(values);
        if (onValuesChanged)
            onValuesChanged(values);
    }, [onValuesChanged]);

    useEffect(() => {
        if (entityId && onIdChange)
            onIdChange(entityId);
    }, [entityId, onIdChange]);

    const collection = useMemo(() => resolveCollection<M>({
        collection: inputCollection,
        path,
        entityId,
        values: internalValues,
        previousValues: initialValues,
        fields: context.fields
    }), [inputCollection, path, entityId, internalValues, initialValues, context.fields]);

    const onIdUpdate = collection.callbacks?.onIdUpdate;
    useEffect(() => {
        if (onIdUpdate && internalValues && (status === "new" || status === "copy")) {
            try {
                setEntityId(
                    onIdUpdate({
                        collection,
                        path,
                        entityId,
                        values: internalValues,
                        context
                    })
                );
            } catch (e) {
                console.error(e);
            }
        }
    }, [collection, context, entityId, internalValues, onIdUpdate, path, status]);

    const underlyingChanges: Partial<EntityValues<M>> = useMemo(() => {
        if (initialValues && status === "existing") {
            return Object.entries(collection.properties)
                .map(([key, property]) => {
                    if (isHidden(property)) {
                        return {};
                    }
                    const initialValue = initialValues[key];
                    const latestValue = baseDataSourceValues[key];
                    if (!equal(initialValue, latestValue)) {
                        return { [key]: latestValue };
                    }
                    return {};
                })
                .reduce((a, b) => ({ ...a, ...b }), {}) as Partial<EntityValues<M>>;
        } else {
            return {};
        }
    }, [baseDataSourceValues, collection.properties, initialValues, status]);

    const saveValues = useCallback((values: EntityValues<M>, formikActions: FormikHelpers<EntityValues<M>>) => {

        if (mustSetCustomId && !entityId) {
            console.error("Missing custom Id");
            setEntityIdError(true);
            formikActions.setSubmitting(false);
            return;
        }

        setSavingError(undefined);
        setEntityIdError(false);

        if (status === "existing") {
            if (!entity?.id) throw Error("Form misconfiguration when saving, no id for existing entity");
        } else if (status === "new" || status === "copy") {
            if (collection.customId) {
                if (collection.customId !== "optional" && !entityId) {
                    throw Error("Form misconfiguration when saving, entityId should be set");
                }
            }
        } else {
            throw Error("New FormType added, check EntityForm");
        }

        onEntitySave?.({
            collection,
            path,
            entityId,
            values,
            previousValues: entity?.values,
            closeAfterSave: closeAfterSaveRef.current
        })
            .then(_ => {
                const eventName: CMSAnalyticsEvent = status === "new"
                    ? "new_entity_saved"
                    : (status === "copy" ? "entity_copied" : (status === "existing" ? "entity_edited" : "unmapped_event"));
                context.onAnalyticsEvent?.(eventName, { path });
                setInitialValues(values);
                formikActions.resetForm({
                    values,
                    submitCount: 0,
                    touched: {}
                });
            })
            .catch(e => {
                console.error(e);
                setSavingError(e);
            })
            .finally(() => {
                closeAfterSaveRef.current = false;
                formikActions.setSubmitting(false);
            });

    }, [mustSetCustomId, entityId, status, onEntitySave, collection, path, entity?.values, entity?.id, context]);

    const uniqueFieldValidator: CustomFieldValidator = useCallback(({
                                                                        name,
                                                                        value,
                                                                        property
                                                                    }) => dataSource.checkUniqueField(path, name, value, property, entityId),
        [dataSource, path, entityId]);

    const validationSchema = useMemo(() => entityId
            ? getYupEntitySchema(
                entityId,
                collection.properties,
                uniqueFieldValidator)
            : undefined,
        [entityId, collection.properties, uniqueFieldValidator]);

    return (
        <Formik
            initialValues={baseDataSourceValues as M}
            onSubmit={saveValues}
            validationSchema={validationSchema}
            validate={(values) => console.debug("Validating", values)}
            onReset={() => onDiscard && onDiscard()}
        >
            {(props) => {

                const pluginActions: React.ReactNode[] = [];

                // eslint-disable-next-line react-hooks/rules-of-hooks
                const formController: FormController<M> = {
                    setFieldValue: props.setFieldValue,
                    values: props.values
                };

                // eslint-disable-next-line react-hooks/rules-of-hooks
                useEffect(() => {
                    if (onFormControllerChange) {
                        onFormControllerChange(formController);
                    }
                }, [onFormControllerChange, formController]);

                if (plugins && collection) {
                    const actionProps: PluginFormActionProps = {
                        entityId,
                        path,
                        status,
                        collection,
                        context,
                        currentEntityId: entityId,
                        formController
                    };
                    pluginActions.push(...plugins.map((plugin, i) => (
                        plugin.form?.Actions
                            ? <plugin.form.Actions
                                key={`actions_${plugin.name}`} {...actionProps}/>
                            : null
                    )).filter(Boolean));
                }

                return <>

                    <Box
                        sx={(theme) => ({
                            paddingLeft: theme.spacing(4),
                            paddingRight: theme.spacing(4),
                            paddingTop: theme.spacing(3),
                            paddingBottom: theme.spacing(4),
                            marginBottom: theme.spacing(2),
                            [theme.breakpoints.down("lg")]: {
                                paddingLeft: theme.spacing(2),
                                paddingRight: theme.spacing(2),
                                paddingTop: theme.spacing(2),
                                paddingBottom: theme.spacing(3)
                            },
                            [theme.breakpoints.down("md")]: {
                                padding: theme.spacing(2)
                            }
                        })}
                    >

                        {pluginActions.length > 0 && <Box
                            sx={(theme) => ({
                                width: "100%",
                                display: "flex",
                                justifyContent: "flex-end",
                                background: theme.palette.mode === "light" ? "rgba(255,255,255,0.6)" : alpha(theme.palette.background.paper, 0.1),
                                backdropFilter: "blur(8px)",
                                borderBottom: `1px solid ${theme.palette.divider}`,
                                flexDirection: "row",
                                alignItems: "center",
                                position: "absolute",
                                top: 0,
                                right: 0,
                                left: 0,
                                textAlign: "right",
                                zIndex: 2,
                                "& > *:not(:last-child)": {
                                    [theme.breakpoints.down("md")]: {
                                        mr: theme.spacing(1)
                                    },
                                    mr: theme.spacing(2)
                                }
                            })}>
                            {pluginActions}
                        </Box>}

                        <Box
                            sx={(theme) => ({
                                width: "100%",
                                marginTop: theme.spacing(4 + (pluginActions ? 4 : 0)),
                                paddingY: 2,
                                display: "flex",
                                alignItems: "center",
                                [theme.breakpoints.down("lg")]: {
                                    marginTop: theme.spacing(3 + (pluginActions ? 4 : 0))
                                },
                                [theme.breakpoints.down("md")]: {
                                    marginTop: theme.spacing(2 + (pluginActions ? 4 : 0))
                                }
                            })}>

                            <Typography
                                sx={{
                                    marginTop: 4,
                                    marginBottom: collection.hideIdFromForm ? 0 : 4,
                                    flexGrow: 1
                                }}
                                variant={"h4"}>{collection.singularName ?? collection.name + " entry"}
                            </Typography>
                        </Box>

                        {!hideId &&
                            <CustomIdField customId={collection.customId}
                                           entityId={entityId}
                                           status={status}
                                           onChange={setEntityId}
                                           error={entityIdError}
                                           entity={entity}/>}

                        {entityId && <InnerForm
                            {...props}
                            initialValues={initialValues}
                            onModified={onModified}
                            onValuesChanged={doOnValuesChanges}
                            underlyingChanges={underlyingChanges}
                            path={path}
                            entity={entity}
                            entityId={entityId}
                            collection={collection}
                            status={status}
                            savingError={savingError}
                            closeAfterSaveRef={closeAfterSaveRef}/>}

                    </Box>
                </>
            }}
        </Formik>
    );
}

function InnerForm<M extends Record<string, any>>(props: FormikProps<M> & {
    initialValues: Partial<M>,
    onModified: ((modified: boolean) => void) | undefined,
    onValuesChanged?: (changedValues?: EntityValues<M>) => void,
    underlyingChanges: Partial<M>,
    path: string
    entity: Entity<M> | undefined,
    collection: ResolvedEntityCollection<M>,
    entityId: string,
    status: "new" | "existing" | "copy",
    savingError?: Error,
    closeAfterSaveRef: MutableRefObject<boolean>,
}) {

    const {
        initialValues,
        values,
        onModified,
        onValuesChanged,
        underlyingChanges,
        entityId,
        entity,
        touched,
        setFieldValue,
        collection,
        path,
        isSubmitting,
        status,
        handleSubmit,
        savingError,
        dirty,
        errors,
        closeAfterSaveRef
    } = props;

    const { t } = useTranslation();
    const modified = dirty;
    useEffect(() => {
        if (onModified)
            onModified(modified);
        if (onValuesChanged)
            onValuesChanged(values);
    }, [modified, onModified, onValuesChanged, values]);

    useEffect(() => {
        if (underlyingChanges && entity) {
            // we update the form fields from the Firestore data
            // if they were not touched
            Object.entries(underlyingChanges).forEach(([key, value]) => {
                const formValue = values[key];
                if (!equal(value, formValue) && !touched[key]) {
                    console.debug("Updated value from the datasource:", key, value);
                    setFieldValue(key, value !== undefined ? value : null);
                }
            });
        }
    }, [underlyingChanges, entity, values, touched, setFieldValue]);

    const formContext: FormContext<M> | undefined = {
        collection,
        entityId,
        values,
        path
    };

    const formFields = (
        <Grid container spacing={6}>
            {Object.entries<ResolvedProperty>(collection.properties)
                .filter(([key, property]) => !isHidden(property))
                .map(([key, property]) => {

                    const underlyingValueHasChanged: boolean =
                        !!underlyingChanges &&
                        Object.keys(underlyingChanges).includes(key) &&
                        !!touched[key];

                    const disabled = isSubmitting || isReadOnly(property) || Boolean(property.disabled);
                    const cmsFormFieldProps: PropertyFieldBindingProps<any, M> = {
                        propertyKey: key,
                        disabled,
                        property,
                        includeDescription: true,
                        underlyingValueHasChanged,
                        context: formContext,
                        tableMode: false,
                        partOfArray: false,
                        autoFocus: false
                    };

                    return (
                        <Grid item
                              xs={12}
                              id={`form_field_${key}`}
                              key={`field_${collection.name}_${key}`}>
                            <PropertyFieldBinding {...cmsFormFieldProps}/>
                        </Grid>
                    );
                })}

        </Grid>
    );

    const disabled = isSubmitting || (!modified && status === "existing");
    const formRef = React.createRef<HTMLDivElement>();

    return (

        <Form onSubmit={handleSubmit}
              noValidate>
            <Box sx={{ mt: 4 }}
                 ref={formRef}>

                {formFields}

                <ErrorFocus containerRef={formRef}/>

            </Box>

            <Box sx={{ height: 56 }}/>

            <CustomDialogActions position={"absolute"}>

                {savingError &&
                    <Box textAlign="right">
                        <Typography color={"error"}>
                            {savingError.message}
                        </Typography>
                    </Box>}

                {status === "existing" &&
                    <Button
                        variant="text"
                        color="primary"
                        disabled={disabled}
                        type="reset"
                    >
                          {t("buttonLabels.discard")}
                    </Button>}

                <Button
                    variant="text"
                    color="primary"
                    type="submit"
                    disabled={disabled}
                    onClick={() => {
                        closeAfterSaveRef.current = false;
                    }}
                >
                    {status === "existing" && t("buttonLabels.save")}
                    {status === "copy" && t("buttonLabels.createCopy")}
                    {status === "new" && t("buttonLabels.create")}
                </Button>

                <Button
                    variant="contained"
                    color="primary"
                    type="submit"
                    disabled={disabled}
                    onClick={() => {
                        closeAfterSaveRef.current = true;
                    }}
                >
                    {status === "existing" && t("buttonLabels.saveAndClose")}
                    {status === "copy" && t("buttonLabels.createCopyAndClose")}
                    {status === "new" && t("buttonLabels.createAndClose")}
                </Button>

            </CustomDialogActions>
        </Form>
    );
}
