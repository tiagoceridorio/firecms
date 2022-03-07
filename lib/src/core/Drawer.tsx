import React, { useCallback, useMemo } from "react";

import { Link as ReactLink, NavLink } from "react-router-dom";
import {
    Box,
    Button,
    Divider,
    Link,
    List,
    ListItem,
    Tooltip,
    Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import {
    computeTopNavigation,
    TopNavigationEntry,
    TopNavigationResult
} from "./util/navigation_utils";
import { useNavigation } from "../hooks";
import { FireCMSLogo } from "./components/FireCMSLogo";

/**
 * Props used in case you need to override the default drawer
 * @category Core
 */
export interface DrawerProps {
    logo: string | undefined,
    closeDrawer: () => any,
}

/**
 * Default drawer used in the CMS
 * @category Core
 */
export function Drawer({
                           logo,
                           closeDrawer
                       }: DrawerProps) {

    const navigationContext = useNavigation();

    const {
        navigationEntries,
        groups
    }: TopNavigationResult = useMemo(() => computeTopNavigation(navigationContext, true), [navigationContext]);

    const ungroupedNavigationViews = Object.values(navigationEntries).filter(e => !e.group);

    const buildNavigationListItem = useCallback((index: number, group: string, entry: TopNavigationEntry) =>
        <ListItem
            // @ts-ignore
            button
            key={`navigation_${index}`}
            component={NavLink}
            onClick={closeDrawer}
            // @ts-ignore
            style={({ isActive }) => ({
                fontWeight: isActive ? "600" : "500",
                background: isActive ? "rgba(128,128,128,0.1)" : "inherit"
            })}
            to={entry.url}
        >
            <PlaylistPlayIcon fontSize={"small"} color={"disabled"}/>
            <Typography
                variant={"subtitle2"}
                sx={{
                    fontWeight: "inherit",
                    p: 0.5
                }}>
                {entry.name.toUpperCase()}
            </Typography>
        </ListItem>, [closeDrawer]);

    const buildGroupHeader = useCallback((group?: string) =>
        <Box pt={2} pl={2} pr={2} pb={0.5} sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center"
        }}>
            <Typography variant={"caption"}
                        color={"textSecondary"}
                        className={"weight-500"}
                        sx={{ flexGrow: 1 }}>
                {group ? group.toUpperCase() : "Ungrouped collections".toUpperCase()}
            </Typography>
            <Tooltip
                title={group ? `Create new collection in ${group}` : "Create new collection"}>
                <Button
                    size={"small"}
                    onClick={closeDrawer}
                    component={ReactLink}
                    to={navigationContext.buildUrlEditCollectionPath({ group })}
                    state={{ group: group }}>
                    <AddIcon fontSize={"small"}/>
                </Button>
            </Tooltip>
        </Box>, [closeDrawer, navigationContext]);

    let logoComponent;
    if (logo) {
        logoComponent = <img
            style={{
                maxWidth: "100%",
                maxHeight: "100%"
            }}
            src={logo}
            alt={"Logo"}/>;
    } else {
        logoComponent = <FireCMSLogo/>;
    }

    return (
        <div>
            <Link
                key={"breadcrumb-home"}
                color="inherit"
                onClick={closeDrawer}
                component={NavLink}

                to={navigationContext.homeUrl}>
                <Box sx={{
                    padding: 4,
                    maxWidth: 280
                }}>
                    {logoComponent}
                </Box>

            </Link>
            <List>

                {groups.map((group) => (
                    <React.Fragment
                        key={`drawer_group_${group}`}>
                        <Divider key={`divider_${group}`}/>
                        {buildGroupHeader(group)}
                        {Object.values(navigationEntries)
                            .filter(e => e.group === group)
                            .map((view, index) => buildNavigationListItem(index, group, view))}
                    </React.Fragment>
                ))}

                {ungroupedNavigationViews.length > 0 && <>
                    <Divider/>
                    {buildGroupHeader()}
                </>}

                {ungroupedNavigationViews.map((view, index) => buildNavigationListItem(index, "none", view))}

            </List>
        </div>
    );
}
