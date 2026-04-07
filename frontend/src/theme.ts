import { createTheme, type Theme, alpha } from '@mui/material/styles';

// Brand colors
const GOLD_DARK = '#F3C24B';    // Primary for dark theme — rgb(243, 194, 75)
const GOLD_LIGHT = '#E5A816';   // Primary for light theme — more saturated, punchier
const GOLD_HOVER = '#D49B10';
const SLATE = '#3B82C4';        // Secondary — calm blue

export function getTheme(mode: 'dark' | 'light'): Theme {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? GOLD_DARK : GOLD_LIGHT,
        contrastText: '#000000',
      },
      secondary: {
        main: SLATE,
        contrastText: '#FFFFFF',
      },
      background: {
        default: isDark ? '#101010' : '#F8F9FA',
        paper: isDark ? '#1C1C1C' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#FFFFFF' : '#1A1A2E',
        secondary: isDark ? '#94A3B8' : '#5A6478',
      },
      divider: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      error: {
        main: isDark ? '#F87171' : '#DC2626',
      },
      success: {
        main: isDark ? '#4ADE80' : '#16A34A',
      },
    },
    breakpoints: {
      values: {
        xs: 0,
        sm: 600,
        md: 1024,
        lg: 1536,
        xl: 1920,
      },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: (theme) => ({
          '*': {
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderRadius: '10px',
              border: '2px solid transparent',
              backgroundClip: 'padding-box',
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
              },
            },
          },
        }),
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
          containedPrimary: {
            color: '#000000',
            '&:hover': {
              backgroundColor: GOLD_HOVER,
            },
          },
          outlinedPrimary: {
            borderColor: isDark ? GOLD_DARK : GOLD_LIGHT,
            color: isDark ? GOLD_DARK : '#B8890A',
            '&:hover': {
              borderColor: GOLD_HOVER,
              backgroundColor: isDark ? 'rgba(243,194,75,0.08)' : 'rgba(229,168,22,0.08)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          elevation1: {
            boxShadow: isDark
              ? '0 1px 6px rgba(0,0,0,0.4)'
              : '0 1px 4px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.06)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? '#242424' : '#FFFFFF',
            borderRadius: 14,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
            boxShadow: isDark
              ? 'none'
              : '0 1px 4px rgba(0,0,0,0.05), 0 0 1px rgba(0,0,0,0.06)',
            transition: 'box-shadow 0.2s, transform 0.15s',
            '&:hover': {
              boxShadow: isDark
                ? '0 4px 16px rgba(0,0,0,0.5)'
                : '0 4px 16px rgba(0,0,0,0.1)',
            },
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? '#141414' : '#FAFBFC',
            borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#0F0F0F' : '#FFFFFF',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
          },
        },
      },
      MuiListItem: {
        styleOverrides: {
          root: {
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 16,
            paddingRight: 16,
            '&.MuiListItem-dense': {
              paddingTop: 4,
              paddingBottom: 4,
            },
            '&.MuiListItem-gutters': {
              paddingLeft: 16,
              paddingRight: 16,
            },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 16,
            paddingRight: 16,
            borderRadius: 8,
            marginBottom: 2,
            transition: 'all 0.15s ease',
            '&.Mui-dense': {
              paddingTop: 4,
              paddingBottom: 4,
            },
            ...(isDark
              ? {
                  '&:hover': {
                    backgroundColor: 'rgba(243,194,75,0.08)',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(243,194,75,0.12)',
                    color: GOLD_DARK,
                    '& .MuiListItemIcon-root': { color: GOLD_DARK },
                    '&:hover': {
                      backgroundColor: 'rgba(243,194,75,0.18)',
                    },
                  },
                }
              : {
                  '&:hover': {
                    backgroundColor: '#EBEDF0',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(229,168,22,0.10)',
                    color: '#1A1A2E',
                    fontWeight: 600,
                    '& .MuiListItemIcon-root': { color: GOLD_LIGHT },
                    '&:hover': {
                      backgroundColor: 'rgba(229,168,22,0.16)',
                    },
                  },
                }),
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 16,
            paddingRight: 16,
            borderRadius: 6,
            margin: '0 4px',
            '&.Mui-selected': {
              backgroundColor: isDark ? 'rgba(243,194,75,0.12)' : 'rgba(229,168,22,0.10)',
              color: isDark ? GOLD_DARK : '#1A1A2E',
              fontWeight: 600,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            paddingTop: 6,
            paddingBottom: 6,
            paddingLeft: 16,
            paddingRight: 16,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
            '&.MuiTableCell-head': {
              paddingTop: 10,
              paddingBottom: 10,
              backgroundColor: isDark ? '#181818' : '#F8F9FA',
              fontWeight: 600,
              fontSize: '0.78rem',
              letterSpacing: '0.02em',
              color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
              textTransform: 'uppercase',
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 0.12s',
            '&.MuiTableRow-hover:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            },
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
            boxShadow: 'none',
            overflow: 'hidden',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
              transition: 'box-shadow 0.15s',
              '& fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.13)',
                transition: 'border-color 0.15s',
              },
              '&:hover fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.25)',
              },
              '&.Mui-focused': {
                boxShadow: `0 0 0 3px ${alpha(isDark ? GOLD_DARK : GOLD_LIGHT, 0.18)}`,
              },
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          outlined: {
            borderRadius: 10,
          },
        },
      },
    },
  });
}
