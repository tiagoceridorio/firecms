import * as React from "react";
import { Dialog } from "@mui/material";

import { EntityCollection } from "../index";
import { CollectionEditor } from "./CollectionEditor";

export interface CollectionEditorDialogProps {
    open: boolean;
    onSave: (collection?: EntityCollection) => void;
    onCancel?: () => void;
    path: string;
}

export function CollectionEditorDialog({
                                           open,
                                           onSave,
                                           onCancel,
                                           path
                                       }: CollectionEditorDialogProps) {

    return (
        <Dialog
            open={open}
            maxWidth={"lg"}
            fullWidth
            PaperProps={{
                sx: (theme) => ({
                    // height: "100vh",
                    background: theme.palette.background.default
                })
            }}
        >
            <CollectionEditor path={path}
                              onCancel={onCancel}
                              includeCollectionLink={false}
                              onSave={onSave}/>
        </Dialog>
    );
}
