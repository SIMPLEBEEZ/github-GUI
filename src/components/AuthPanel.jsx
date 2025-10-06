import React, { useEffect, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { useGitHubOAuth } from "../hooks/useGitHubOAuth";

export default function AuthPanel({ onAuthenticated, setSnack }) {
  const { auth, login, loading } = useGitHubOAuth();

  useEffect(() => {
    if (auth?.token) {
      onAuthenticated(auth);
      setSnack({ open: true, message: "Successfully logged in with GitHub." });
    }
  }, [auth]);

  return (
    <Card sx={{ mt: 4 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Sign in with GitHub
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Click the button below to log in securely using GitHub OAuth Device Flow.
        </Typography>
        <Button
          variant="contained"
          onClick={login}
          disabled={loading}
        >
          {loading ? "Waiting for authorization..." : "Sign in with GitHub"}
        </Button>
      </CardContent>
    </Card>
  );
}
