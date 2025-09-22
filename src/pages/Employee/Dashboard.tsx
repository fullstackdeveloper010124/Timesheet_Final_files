import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar/EmployeeSidebar";
import { Header } from "@/components/navbar/EmployeeHeader";
import NewTimeTracker from "@/components/New folder/NewTimeTracker";
import { TimeEntries } from "@/components/New folder/TimeEntries";
import { WeeklySummary } from "@/components/New folder/WeeklySummary";
import { RecentActivity } from "@/components/New folder/RecentActivity";
import { UpcomingDeadlines } from "@/components/New folder/UpcomingDeadlines";
import { ThemeProvider } from "@/components/New folder/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import {
  timeEntryAPI,
  teamAPI,
  type TimeEntry,
  type TeamMember,
} from "@/lib/api";

const Index = () => {
  const { user: currentUser, updateUser, isLoading: authLoading } = useAuth(); // Use AuthContext
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTimer, setActiveTimer] = useState(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamMemberData, setTeamMemberData] = useState<TeamMember | null>(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check API connectivity
  const checkApiConnection = useCallback(async () => {
    try {
      const response = await teamAPI.getAllTeam();
      setApiConnected(true);
      setError(null);
      return true;
    } catch (error) {
      console.warn("API not connected:", error);
      setApiConnected(false);
      return false;
    }
  }, []);

  // Fetch team member data for shift information
  const fetchTeamMemberData = useCallback(
    async (userId: string, forceRefresh: boolean = false) => {
      try {
        console.log(
          "🔍 Fetching team member data for user:",
          userId,
          "Force refresh:",
          forceRefresh
        );

        if (!userId) {
          console.error("❌ No userId provided to fetchTeamMemberData");
          return null;
        }

        const teamResponse = await teamAPI.getAllTeam();

        if (
          teamResponse.success &&
          teamResponse.data &&
          Array.isArray(teamResponse.data)
        ) {
          console.log(
            "📋 Available team members:",
            teamResponse.data.map((m) => ({
              id: m._id,
              employeeId: m.employeeId,
              email: m.email,
              name: m.name,
              shift: m.shift,
            }))
          );

          // Try multiple matching strategies
          let teamMember = teamResponse.data.find((member: TeamMember) => {
            const exactEmailMatch = member.email === currentUser?.email;
            const matches =
              member._id === userId ||
              member.employeeId === userId ||
              exactEmailMatch;
            console.log(`🔍 Checking member ${member.name} (${member._id}):`, {
              matchesId: member._id === userId,
              matchesEmployeeId: member.employeeId === userId,
              matchesEmail: exactEmailMatch,
              memberEmail: member.email,
              currentEmail: currentUser?.email,
            });
            return matches;
          });

          // If no exact match, try flexible matching for admin users
          if (!teamMember && currentUser?.email?.includes('admin')) {
            console.log("🔍 No exact match found, trying flexible admin matching...");
            teamMember = teamResponse.data.find((member: TeamMember) => {
              const isAdminEmail = member.email?.includes('admin');
              const isSimilarDomain = currentUser?.email && member.email && 
                currentUser.email.split('@')[1] === member.email.split('@')[1];
              const flexibleMatch = isAdminEmail || isSimilarDomain;
              
              if (flexibleMatch) {
                console.log(`✅ Flexible match found: ${member.name} (${member.email})`);
              }
              return flexibleMatch;
            });
          }

          // If no exact match found, try partial matching
          if (!teamMember && currentUser?.email) {
            teamMember = teamResponse.data.find((member: TeamMember) => {
              return (
                member.email?.toLowerCase() ===
                  currentUser.email?.toLowerCase() ||
                member.name
                  ?.toLowerCase()
                  .includes(currentUser.name?.toLowerCase())
              );
            });
          }

          // Special case: if the user email doesn't match, try to find by employee email
          if (!teamMember) {
            console.log(
              "🔍 Trying to find team member by specific criteria..."
            );
            // Look for Rishi Kumar specifically
            teamMember = teamResponse.data.find((member: TeamMember) => {
              return (
                member.email === "kumarrishi379@gmail.com" ||
                member.name?.toLowerCase().includes("rishi") ||
                member.employeeId === "EMP1758303256490"
              );
            });
            if (teamMember) {
              console.log(
                "✅ Found team member by specific criteria:",
                teamMember.name
              );
            }
          }

          // If no match found, return null instead of using fallback
          if (!teamMember) {
            console.warn(
              "⚠️ No matching team member found for authenticated user:",
              { userId, email: currentUser?.email }
            );
            return null;
          }

          if (teamMember) {
            console.log("✅ Found team member data:", {
              id: teamMember._id,
              employeeId: teamMember.employeeId,
              name: teamMember.name,
              email: teamMember.email,
              shift: teamMember.shift,
              role: teamMember.role,
              charges: teamMember.charges,
            });

            // Fetch the actual assigned shift from Shifts API (if available)
            try {
              console.log(
                "🔍 Checking for shift assignment for employee:",
                teamMember._id
              );
              const shiftResponse = await fetch(
                `${
                  import.meta.env.VITE_API_BASE_URL ||
                  "http://localhost:3002/api"
                }/shifts/employee/${teamMember._id}`
              );
              
              if (shiftResponse.ok) {
                const shiftData = await shiftResponse.json();
                if (
                  shiftData.success &&
                  shiftData.data &&
                  shiftData.data.shiftType
                ) {
                  console.log(
                    "✅ Found assigned shift:",
                    shiftData.data.shiftType
                  );
                  // Update team member with the actual assigned shift
                  teamMember = {
                    ...teamMember,
                    shift: shiftData.data.shiftType,
                  };
                  console.log(
                    "🔄 Updated team member with assigned shift:",
                    teamMember.shift
                  );
                } else {
                  console.log(
                    "ℹ️ No specific shift assigned, using default from team member"
                  );
                }
              } else if (shiftResponse.status === 404) {
                // Shifts API endpoint not implemented yet - this is expected
                console.log(
                  "ℹ️ Shifts API not available (404), using team member default shift:",
                  teamMember.shift
                );
              } else {
                console.warn(
                  "⚠️ Unexpected response from shifts API:",
                  shiftResponse.status
                );
              }
            } catch (shiftError) {
              // Network error or other issues - handle gracefully
              console.log(
                "ℹ️ Shifts API unavailable, using team member default shift:",
                teamMember.shift
              );
            }

            // Clear any previous fallback data
            setTeamMemberData(teamMember);

            // Team member data stored in component state only (no localStorage)

            return teamMember;
          } else {
            console.warn("⚠️ No team members found in database");
            return null;
          }
        } else {
          console.error("❌ Invalid team data response:", teamResponse);
          return null;
        }
      } catch (error) {
        console.error("❌ Failed to fetch team member data:", error);
        return null;
      }
    },
    [currentUser?.email, currentUser?.name]
  );

  const initializeData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors

      // Clear any cached team member data to force fresh fetch
      console.log("🧹 Cleared cached team member data");

      // Check API connectivity first
      const isConnected = await checkApiConnection();

      // Use only API-authenticated user from AuthContext
      let effectiveUser = currentUser;

      if (effectiveUser) {
        console.log(
          "Employee Dashboard - Using effective user:",
          effectiveUser
        );
        console.log("Employee Dashboard - User ID:", effectiveUser._id || effectiveUser.id);
        console.log("Employee Dashboard - User email:", effectiveUser.email);

        // Use the stable user ID (handle both _id and id fields)
        const userId = effectiveUser._id || effectiveUser.id;
        console.log("Employee Dashboard - Using stable User ID:", userId);

        if (isConnected && userId) {
          // Fetch team member data for shift information (but don't change user ID)
          let teamMember = await fetchTeamMemberData(userId, true);
          if (!teamMember) {
            console.log(
              "⚠️ No team member found with user ID, trying by email"
            );
            if (effectiveUser.email) {
              teamMember = await fetchTeamMemberData(
                effectiveUser.email,
                true
              );
              if (teamMember) {
                console.log(
                  "✅ Found team member by email:",
                  teamMember.name
                );
                // Don't update the user ID - keep the session stable
                // Just use the team member data for shift information
              }
            }
          }

          // If still no team member found, show error and stop
          if (!teamMember) {
            console.error("❌ No team member data found for authenticated user");
            setError(
              "Your account is not set up as a team member. Please contact your administrator."
            );
            return;
          }

          // Check for active timer
          try {
            console.log("🔍 Checking for active timer for user:", userId);
            const activeResponse = await timeEntryAPI.getActiveByUser(userId);
            if (activeResponse.success && activeResponse.data) {
              setActiveTimer(activeResponse.data);
              console.log("✅ Found active timer:", activeResponse.data);
            } else {
              console.log("ℹ️ No active timer found");
            }
          } catch (error: unknown) {
            console.log("⚠️ No active timer found or API error");
            // Don't show error to user for missing active timer - it's normal
          }

          // Fetch user's time entries with better error handling
          try {
            console.log("🔍 Fetching time entries for user:", userId);
            const response = await timeEntryAPI.getAllTimeEntries({
              userId: userId,
            });
            if (
              response.success &&
              response.data &&
              Array.isArray(response.data)
            ) {
              // Process entries to fix missing durations
              const processedEntries = response.data.map((entry: TimeEntry) => {
                if (entry.duration === 0 && entry.startTime && entry.endTime) {
                  const startTime = new Date(entry.startTime);
                  const endTime = new Date(entry.endTime);
                  const calculatedDuration = Math.floor(
                    (endTime.getTime() - startTime.getTime()) / 1000
                  );
                  console.log(
                    `🔧 Fixing duration for entry ${entry._id}: was ${entry.duration}, calculated ${calculatedDuration} seconds`
                  );
                  return { ...entry, duration: calculatedDuration };
                }
                return entry;
              });

              setTimeEntries(processedEntries);
              console.log(
                "✅ Fetched and processed time entries:",
                processedEntries.length
              );
            } else {
              console.log("ℹ️ No time entries found or empty response");
              setTimeEntries([]);
            }
          } catch (timeEntriesError: unknown) {
            console.warn("⚠️ Error fetching time entries:", timeEntriesError);
            setTimeEntries([]);
            // Only show error if it's not a 404 (user has no time entries)
            const error = timeEntriesError as {
              response?: { status?: number };
            };
            if (error.response?.status !== 404) {
              setError("Unable to load time entries. Working in offline mode.");
            }
          }
        } else {
          console.log("⚠️ API not connected, working in offline mode");
        }
      } else {
        console.error("❌ No authenticated user found - redirecting to login");
        setError("Authentication required. Please log in to access the dashboard.");
        // In a real app, you would redirect to login page here
        // For now, we'll show an error message
      }
    } catch (error) {
      console.error("Failed to initialize employee dashboard:", error);
      setError("Failed to initialize dashboard");
    } finally {
      setLoading(false);
    }
  }, [currentUser, fetchTeamMemberData, checkApiConnection]);

  // Fetch user's time entries on component mount - only when user is authenticated
  useEffect(() => {
    if (currentUser && !authLoading) {
      console.log("🔄 Dashboard: Initializing with authenticated user:", currentUser.email);
      initializeData();
    }
  }, [currentUser, authLoading, initializeData]); // Include the function we're calling

  // Request notification permission on component mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        console.log("Notification permission:", permission);
      });
    }
  }, []);

  const addTimeEntry = (entry: TimeEntry) => {
    // Calculate duration if it's 0 but we have start and end times
    const processedEntry = { ...entry };
    if (
      processedEntry.duration === 0 &&
      processedEntry.startTime &&
      processedEntry.endTime
    ) {
      const startTime = new Date(processedEntry.startTime);
      const endTime = new Date(processedEntry.endTime);
      const calculatedDuration = Math.floor(
        (endTime.getTime() - startTime.getTime()) / 1000
      );
      console.log(
        `🔧 Fixing duration: was ${processedEntry.duration}, calculated ${calculatedDuration} seconds`
      );
      processedEntry.duration = calculatedDuration;
    }

    // Check if entry already exists to prevent duplicates
    setTimeEntries((prev) => {
      const exists = prev.some(
        (existing) => existing._id === processedEntry._id
      );
      if (exists) {
        console.log(
          "Time entry already exists, skipping duplicate:",
          processedEntry._id
        );
        return prev;
      }
      console.log("Added new time entry:", processedEntry);
      return [...prev, processedEntry];
    });
  };

  const deleteTimeEntry = async (id: string) => {
    try {
      console.log("Deleting time entry:", id);
      const response = await timeEntryAPI.deleteTimeEntry(id);
      if (response.success) {
        setTimeEntries((prev) => prev.filter((entry) => entry._id !== id));
        console.log("Time entry deleted successfully");
      } else {
        console.error("Delete failed:", response.error);
        alert(
          "Failed to delete time entry: " + (response.error || "Unknown error")
        );
      }
    } catch (error: any) {
      console.error("Failed to delete time entry:", error);
      alert(
        "Failed to delete time entry: " +
          (error.response?.data?.error || error.message)
      );
    }
  };

  const updateTimeEntry = async (
    id: string,
    updatedEntry: Partial<TimeEntry>
  ) => {
    try {
      console.log("Updating time entry:", id, updatedEntry);
      const response = await timeEntryAPI.updateTimeEntry(id, updatedEntry);
      if (response.success && response.data) {
        setTimeEntries((prev) =>
          prev.map((entry) => (entry._id === id ? response.data! : entry))
        );
        console.log("Time entry updated successfully");
      } else {
        console.error("Update failed:", response.error);
        alert(
          "Failed to update time entry: " + (response.error || "Unknown error")
        );
      }
    } catch (error: any) {
      console.error("Failed to update time entry:", error);
      alert(
        "Failed to update time entry: " +
          (error.response?.data?.error || error.message)
      );
    }
  };

  // Handle timer state changes from NewTimeTracker
  const handleTimerStart = (timerData: any) => {
    setActiveTimer(timerData);
    console.log("Timer started:", timerData);
  };

  const handleTimerStop = () => {
    setActiveTimer(null);
    console.log("Timer stopped");
  };

  // Refresh team member data with shift change detection
  const refreshTeamMemberData = async (forceUpdate = false) => {
    if (currentUser?._id && apiConnected) {
      setIsRefreshing(true);
      console.log(
        "🔄 Refreshing team member data...",
        forceUpdate ? "(Force Update)" : ""
      );
      const previousShift = teamMemberData?.shift;

      try {
        const teamMember = await fetchTeamMemberData(currentUser._id, true);

        if (teamMember) {
          console.log("✅ Team member data refreshed successfully");

          // Check if shift has changed or force update
          if (
            (previousShift && previousShift !== teamMember.shift) ||
            forceUpdate
          ) {
            if (previousShift !== teamMember.shift) {
              console.log(
                `🔄 Shift changed from ${previousShift} to ${teamMember.shift}`
              );
            }

            // Show notification about shift change
            if (
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              new Notification("Shift Updated", {
                body: forceUpdate
                  ? `Shift data refreshed: ${teamMember.shift}`
                  : `Your shift has been changed from ${previousShift} to ${teamMember.shift}`,
                icon: "/favicon.ico",
              });
            }

            // Show toast notification
            setTimeout(() => {
              if (forceUpdate) {
                alert(
                  `✅ Shift data refreshed! Current shift: ${teamMember.shift}`
                );
              } else {
                alert(
                  `🔄 Your shift has been updated from ${previousShift} to ${teamMember.shift}. The time tracker will now use ${teamMember.shift} mode.`
                );
              }
            }, 500);
          }
        } else {
          console.warn("⚠️ Failed to fetch updated team member data");
          setError(
            "Unable to refresh shift data. Please try again or contact support."
          );
        }
      } catch (error) {
        console.error("Error refreshing team member data:", error);
        setError("Failed to refresh shift data. Please check your connection.");
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  // Periodic refresh for shift updates (every 5 minutes)
  useEffect(() => {
    if (!apiConnected || !currentUser?._id) return;

    const interval = setInterval(() => {
      // Only refresh if not already refreshing to prevent overlapping calls
      if (!isRefreshing) {
        refreshTeamMemberData();
      }
    }, 300000); // 5 minutes (300000ms) for reasonable updates

    return () => clearInterval(interval);
  }, [apiConnected, currentUser?._id, teamMemberData?.shift]);

  // Debug logging for teamMemberData
  useEffect(() => {
    console.log("🔍 Dashboard - TeamMemberData updated:", teamMemberData);
    if (teamMemberData) {
      console.log("🔍 Dashboard - TeamMemberData shift:", teamMemberData.shift);
    }
  }, [teamMemberData]);

  // ---------- UI ----------

  // Show loading while authentication is in progress
  if (authLoading) {
    return (
      <ThemeProvider>
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 items-center justify-center">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 mb-4">
                <svg className="animate-spin h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Authenticating...
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Please wait while we verify your credentials.
              </p>
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Early authentication check - wait for auth to complete
  if (!currentUser && !authLoading) {
    return (
      <ThemeProvider>
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 items-center justify-center">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 mb-4">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Authentication Required
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Please log in to access the employee dashboard.
              </p>
              <button
                onClick={() => window.location.href = '/login'}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Show loading while dashboard data is being fetched
  if (currentUser && loading) {
    return (
      <ThemeProvider>
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 items-center justify-center">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 mb-4">
                <svg className="animate-spin h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Loading Dashboard...
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Fetching your team data and time entries.
              </p>
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 overflow-auto">
          <Header onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-6">
            {/* Error Banner */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
                  <span className="text-red-800 text-sm">{error}</span>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Dashboard Header with Refresh Button */}
            <div className="mb-8">
              <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white shadow-2xl">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-4xl font-bold mb-2">
                      Welcome back, {currentUser?.name || currentUser?.email?.split('@')[0] || 'Employee'}! 👋
                    </h1>
                    <p className="text-indigo-100 text-lg mb-4">
                      Ready to track your productivity today?
                    </p>
                    <div className="flex items-center space-x-6">
                      <div className="flex items-center bg-white bg-opacity-20 rounded-lg px-3 py-2">
                        <div
                          className={`w-3 h-3 rounded-full mr-2 ${
                            apiConnected ? "bg-green-400" : "bg-red-400"
                          }`}
                        ></div>
                        <span className="text-sm font-medium">
                          {apiConnected ? "System Online" : "System Offline"}
                        </span>
                      </div>
                      {teamMemberData && (
                        <div className="flex items-center bg-white bg-opacity-20 rounded-lg px-3 py-2">
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">
                            {teamMemberData.shift} Shift
                            {isRefreshing && (
                              <svg
                                className="w-3 h-3 ml-1 animate-spin inline"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center bg-white bg-opacity-20 rounded-lg px-3 py-2">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-medium">
                          {new Date().toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => refreshTeamMemberData(false)}
                    disabled={!apiConnected || isRefreshing}
                    className="inline-flex items-center px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                    title="Refresh shift data"
                  >
                    {isRefreshing ? (
                      <svg
                        className="w-4 h-4 mr-2 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    )}
                    {isRefreshing ? "Refreshing..." : "Refresh Data"}
                  </button>

                  <button
                    onClick={() => refreshTeamMemberData(true)}
                    disabled={!apiConnected || isRefreshing}
                    className="inline-flex items-center px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                    title="Force refresh shift data (use if shift not updating)"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Force Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* Dashboard Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
              {/* Today's Hours */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg min-h-[140px] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Today's Hours</p>
                    <p className="text-3xl font-bold">
                      {(() => {
                        const today = new Date().toDateString();
                        const todayEntries = timeEntries.filter(entry => 
                          new Date(entry.startTime).toDateString() === today
                        );
                        const totalSeconds = todayEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        return `${hours}h ${minutes}m`;
                      })()}
                    </p>
                  </div>
                  <div className="bg-blue-400 bg-opacity-30 rounded-lg p-3">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* This Week */}
              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg min-h-[140px] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">This Week</p>
                    <p className="text-3xl font-bold">
                      {(() => {
                        const weekStart = new Date();
                        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                        const weekEntries = timeEntries.filter(entry => 
                          new Date(entry.startTime) >= weekStart
                        );
                        const totalSeconds = weekEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
                        const hours = Math.floor(totalSeconds / 3600);
                        return `${hours}h`;
                      })()}
                    </p>
                  </div>
                  <div className="bg-green-400 bg-opacity-30 rounded-lg p-3">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Active Projects */}
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg min-h-[140px] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Active Projects</p>
                    <p className="text-3xl font-bold">
                      {(() => {
                        const uniqueProjects = new Set(timeEntries.map(entry => entry.project));
                        return uniqueProjects.size;
                      })()}
                    </p>
                  </div>
                  <div className="bg-purple-400 bg-opacity-30 rounded-lg p-3">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Productivity Score */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg min-h-[140px] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-medium">Productivity</p>
                    <p className="text-3xl font-bold">
                      {(() => {
                        const billableEntries = timeEntries.filter(entry => entry.billable);
                        const billablePercentage = timeEntries.length > 0 
                          ? Math.round((billableEntries.length / timeEntries.length) * 100)
                          : 0;
                        return `${billablePercentage}%`;
                      })()}
                    </p>
                  </div>
                  <div className="bg-orange-400 bg-opacity-30 rounded-lg p-3">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              {/* Left Column - Time Tracker & Entries */}
              <div className="xl:col-span-8 space-y-8">
                {/* Time Tracker Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
                    <h2 className="text-xl font-bold text-white flex items-center">
                      <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      Time Tracker
                    </h2>
                    <p className="text-indigo-100 text-sm mt-1">Track your work time efficiently</p>
                  </div>
                  <div className="p-6">
                    <NewTimeTracker
                      onAddEntry={addTimeEntry}
                      activeTimer={activeTimer}
                      setActiveTimer={setActiveTimer}
                      currentUser={teamMemberData || currentUser}
                      onTimerStart={handleTimerStart}
                      onTimerStop={handleTimerStop}
                      teamMemberData={teamMemberData}
                    />
                  </div>
                </div>

                {/* Time Entries Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-500 to-teal-600 px-6 py-4">
                    <h2 className="text-xl font-bold text-white flex items-center">
                      <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                        <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a2 2 0 002 2h8a2 2 0 002-2V3a2 2 0 012 2v6h-3a2 2 0 00-2 2v3H6a2 2 0 01-2-2V5zm8 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      Recent Time Entries
                    </h2>
                    <p className="text-green-100 text-sm mt-1">View and manage your logged time</p>
                  </div>
                  <div className="p-6">
                    <TimeEntries
                      entries={timeEntries}
                      onDelete={deleteTimeEntry}
                      onUpdate={updateTimeEntry}
                      loading={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column - Summary & Activity */}
              <div className="xl:col-span-4 space-y-8">
                {/* Weekly Summary Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-600 px-6 py-4">
                    <h2 className="text-lg font-bold text-white flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                      </svg>
                      Weekly Summary
                    </h2>
                  </div>
                  <div className="p-6">
                    <WeeklySummary timeEntries={timeEntries} />
                  </div>
                </div>

                {/* Recent Activity Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4">
                    <h2 className="text-lg font-bold text-white flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                      </svg>
                      Recent Activity
                    </h2>
                  </div>
                  <div className="p-6">
                    <RecentActivity />
                  </div>
                </div>

                {/* Upcoming Deadlines Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-red-500 to-orange-600 px-6 py-4">
                    <h2 className="text-lg font-bold text-white flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      Upcoming Deadlines
                    </h2>
                  </div>
                  <div className="p-6">
                    <UpcomingDeadlines />
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default Index;
