import { Box, Button, Container, Paper, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import { UsersEditTable } from "./UsersEditTable";
import { useConfigController } from "../../useConfigController";
import { RolesDetailsForm } from "./RolesDetailsForm";
import { useCallback, useState } from "react";
import { SassUser } from "../../models/sass_user";

export function UsersEditView() {

    const { users, roles } = useConfigController();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<SassUser | undefined>();

    const onUserClicked = useCallback((user: SassUser) => {
        setDialogOpen(true);
        setSelectedUser(user);
    }, []);

    const handleClose = () => {
        setSelectedUser(undefined);
        setDialogOpen(false);
    };

    return (
        <Container sx={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            py: 2
        }}>
            <Box display={"flex"}
                 sx={{
                     display: "flex",
                     alignItems: "center",
                     my: 2
                 }}>
                <Typography gutterBottom variant="h4"
                            sx={{
                                flexGrow: 1
                            }}
                            component="h4">
                    Users
                </Typography>
                <Button variant={"outlined"}
                        size={"large"}
                        startIcon={<AddIcon/>}
                        onClick={() => setDialogOpen(true)}>
                    Add user
                </Button>
            </Box>

            <Paper variant={"outlined"} sx={{
                flexGrow: 1,
                overflow: "hidden"
            }}>
                <UsersEditTable users={users}
                                onUserClicked={onUserClicked}
                                roles={roles}/>
            </Paper>
            <RolesDetailsForm open={dialogOpen}
                              user={selectedUser}
                              handleClose={handleClose}/>

        </Container>
    )
}
