import React, { useEffect } from "react";
import { Card, CardContent, Typography, Button, Box, CircularProgress } from "@mui/material";
import { useGitHubOAuth } from "../hooks/useGitHubOAuth";
import GitHubIcon from "@mui/icons-material/GitHub";

export default function AuthPanel({ onAuthenticated, setSnack }) {
  const { auth, login, logout, loading } = useGitHubOAuth();

  // Notify parent when login succeeds
  useEffect(() => {
    if (auth?.token) {
      onAuthenticated(auth);
      setSnack({ open: true, message: "Successfully logged in with GitHub." });
    }
  }, [auth]);

  return (
    <Card
      sx={{
        mt: 6,
        mx: "auto",
        maxWidth: 420,
        textAlign: "center",
        p: 2,
        backgroundColor: "#161b22",
        color: "#fff",
        border: "1px solid #30363d",
        borderRadius: 3,
        boxShadow: "0 0 20px rgba(0,0,0,0.3)",
      }}
    >
      <CardContent>
        <Box sx={{ mb: 2 }}>
          <GitHubIcon sx={{ fontSize: 48, color: "#f0f6fc" }} />
        </Box>

        {!auth ? (
          <>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
              Sign in with GitHub
            </Typography>

            <Typography variant="body2" color="gray" sx={{ mb: 4 }}>
              Authorize this app to access your repositories using the secure OAuth Device Flow.
            </Typography>

            <Button
              variant="contained"
              onClick={login}
              disabled={loading}
              startIcon={!loading && <GitHubIcon />}
              sx={{
                backgroundColor: "#238636",
                "&:hover": { backgroundColor: "#2ea043" },
                textTransform: "none",
                fontWeight: 600,
                px: 4,
                py: 1.2,
                borderRadius: 2,
                fontSize: "1rem",
                minWidth: "220px",
              }}
            >
              {loading ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CircularProgress size={20} thickness={5} sx={{ color: "#f0f6fc" }} />
                  <span>Authorizing...</span>
                </Box>
              ) : (
                "Sign in with GitHub"
              )}
            </Button>
          </>
        ) : (
          <>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
              Signed in as {auth.user.login}
            </Typography>
            <img
              src={auth.user.avatar_url}
              alt="avatar"
              width={64}
              height={64}
              style={{ borderRadius: "50%", marginBottom: "1rem" }}
            />
            <Button
              variant="outlined"
              color="error"
              onClick={logout}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                px: 4,
                py: 1.2,
                borderRadius: 2,
                borderColor: "#f85149",
                color: "#f85149",
                "&:hover": { borderColor: "#da3633", backgroundColor: "rgba(218,54,51,0.1)" },
              }}
            >
              Log out
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
