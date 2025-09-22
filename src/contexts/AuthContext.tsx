import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User, authAPI } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (userData: any) => Promise<boolean>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated on app load - API-only approach
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");
      console.log("🔍 AuthContext: Checking for token:", token ? "Found" : "Not found");

      if (token) {
        try {
          console.log("🔄 AuthContext: Validating token with API...");

          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("API timeout")), 5000)
          );

          const response = (await Promise.race([
            authAPI.getCurrentUser(),
            timeoutPromise,
          ])) as any;

          if (response && response.success && response.data) {
            setUser(response.data);
            console.log(
              "✅ AuthContext: User authenticated via API:",
              response.data.name || response.data.email
            );
          } else {
            // Token is invalid, clear storage
            console.warn("Invalid token, clearing authentication");
            localStorage.removeItem("token");
            setUser(null);
          }
        } catch (error) {
          // API failed, clear authentication
          console.warn("Auth API failed, clearing authentication:", error);
          localStorage.removeItem("token");
          setUser(null);
        }
      } else {
        console.log("ℹ️ AuthContext: No token found, user not authenticated");
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    console.log("🔄 AuthContext: Login method called with email:", email);
    try {
      const response = await authAPI.login({ email, password });
      console.log("🔄 AuthContext: Login API response:", response);
      
      if (response.success && response.data) {
        const { token, user: userData } = response.data;
        console.log("🔄 AuthContext: Storing token and user data:", { token: token.substring(0, 20) + "...", user: userData });
        
        localStorage.setItem("token", token);
        console.log("✅ AuthContext: Token stored in localStorage");
        
        setUser(userData);
        console.log("✅ AuthContext: User state updated after login:", userData.email);
        return true;
      } else {
        console.error("❌ AuthContext: Login failed - invalid response:", response);
        return false;
      }
    } catch (error) {
      console.error("❌ AuthContext: Login error:", error);
      return false;
    }
  };

  const signup = async (userData: any): Promise<boolean> => {
    try {
      const response = await authAPI.signup(userData);
      if (response.success && response.data) {
        const { token, user: newUser } = response.data;
        localStorage.setItem("token", token);
        // No user data in localStorage - API-only approach
        setUser(newUser);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Signup error:", error);
      return false;
    }
  };

  const logout = () => {
    authAPI.logout();
    localStorage.removeItem("token"); // Clear token on logout
    setUser(null);
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      // No localStorage storage - API-only approach
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
