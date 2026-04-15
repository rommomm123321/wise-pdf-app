import { useState, useEffect, useRef } from "react";
import { Box, Typography, CircularProgress } from "@mui/material";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";

function GoogleSVG() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [clientId, setClientId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const from = (location.state as any)?.from;
    if (from && from !== "/login") {
      navigate(from, { replace: true });
    } else if (user.systemRole === "GENERAL_ADMIN") {
      navigate("/companies", { replace: true });
    } else {
      navigate("/projects", { replace: true });
    }
  }, [user]);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (
          data.googleClientId &&
          data.googleClientId !== "your_google_client_id_here"
        ) {
          setClientId(data.googleClientId);
        }
      })
      .catch(() => {});
  }, []);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setAuthError(null);
    setLoading(true);
    try {
      await login(credentialResponse.credential);
    } catch (error: any) {
      setAuthError(error?.message || "Authentication failed");
      setLoading(false);
    }
  };

  // Click the hidden Google button when custom button is clicked
  const handleCustomClick = () => {
    if (loading) return;
    const iframe = googleBtnRef.current?.querySelector("iframe");
    if (iframe) {
      // Google renders login inside iframe — simulate click on the container div
      const btn = googleBtnRef.current?.querySelector(
        '[role="button"]',
      ) as HTMLElement;
      if (btn) {
        btn.click();
        return;
      }
    }
    // Fallback: click any clickable child
    const clickable = googleBtnRef.current?.querySelector(
      'div[role="button"], div[tabindex="0"]',
    ) as HTMLElement;
    if (clickable) clickable.click();
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        px: 2,
        bgcolor: "#0f0f0f",
      }}
    >
      {/* Logo */}
      <Box textAlign="center" mb={5}>
        <img
          src="https://wise-bim.com/logo-short.png"
          alt="WISE"
          style={{ height: 100, marginBottom: 16 }}
        />
        <Typography variant="body1" sx={{ color: "#666", fontSize: "0.85rem" }}>
          {t("appDescription", "Collaborative PDF Platform")}
        </Typography>
      </Box>

      {/* Card */}
      <Box
        sx={{
          width: "100%",
          maxWidth: 400,
          bgcolor: "#1a1a1a",
          borderRadius: 3,
          border: "1px solid #2a2a2a",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 4,
            py: 3,
            background: "linear-gradient(135deg, #1a1a1a 0%, #1f1a0e 100%)",
            borderBottom: "1px solid #2a2a2a",
          }}
        >
          <Typography variant="h6" fontWeight={700} color="#fff">
            {t("loginTitle", "Sign in to your account")}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "#666", mt: 0.5, fontSize: "0.8rem" }}
          >
            {t("loginDescription", "Use your Google account to log in")}
          </Typography>
        </Box>

        {/* Body */}
        <Box sx={{ px: 4, py: 4 }}>
          {clientId ? (
            <GoogleOAuthProvider clientId={clientId}>
              <Box sx={{ position: "relative" }}>
                {/* Hidden real Google button */}
                <Box
                  ref={googleBtnRef}
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: 0,
                    height: 0,
                    opacity: 0,
                    overflow: "hidden",
                    pointerEvents: "none",
                    visibility: "hidden",
                  }}
                >
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => {
                      setAuthError("Google login failed");
                      setLoading(false);
                    }}
                    useOneTap
                    theme="filled_black"
                    shape="rectangular"
                    text="continue_with"
                    size="large"
                    width="320"
                  />
                </Box>

                {/* Custom styled button */}
                <Box
                  component="button"
                  onClick={handleCustomClick}
                  disabled={loading}
                  sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    px: 3,
                    py: 1.5,
                    bgcolor: "#222",
                    border: "1px solid #333",
                    borderRadius: "10px",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                    transition: "background 0.15s, border-color 0.15s",
                    "&:hover": loading
                      ? {}
                      : { bgcolor: "#2a2a2a", borderColor: "#444" },
                    outline: "none",
                  }}
                >
                  {loading ? (
                    <CircularProgress
                      size={20}
                      sx={{ color: "#fff", flexShrink: 0 }}
                    />
                  ) : (
                    <GoogleSVG />
                  )}
                  <Typography
                    sx={{ color: "#fff", fontSize: "0.9rem", fontWeight: 500 }}
                  >
                    {loading ? "Signing in..." : "Continue with Google"}
                  </Typography>
                </Box>
              </Box>

              {authError && (
                <Typography
                  variant="caption"
                  sx={{
                    color: "#f44",
                    textAlign: "center",
                    display: "block",
                    mt: 2,
                  }}
                >
                  {authError}
                </Typography>
              )}
            </GoogleOAuthProvider>
          ) : (
            <Typography
              variant="body2"
              sx={{
                color: "#f44",
                bgcolor: "rgba(255,0,0,0.08)",
                p: 2,
                borderRadius: 2,
                textAlign: "center",
              }}
            >
              {t("noConfigWarn", "Google authentication is not configured")}
            </Typography>
          )}
        </Box>

        {/* Footer */}
        <Box
          sx={{ px: 4, py: 2, borderTop: "1px solid #2a2a2a", bgcolor: "#111" }}
        >
          <Typography
            variant="caption"
            sx={{ color: "#444", fontSize: "0.7rem" }}
          >
            By signing in you agree to our terms of service
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
