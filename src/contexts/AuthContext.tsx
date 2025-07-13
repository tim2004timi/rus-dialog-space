import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  tokensSaved: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tokensSaved, setTokensSaved] = useState(false);

  useEffect(() => {
    const processTokens = async () => {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get("access");
      const refreshToken = params.get("refresh");

      console.log('🔍 Проверка токенов в URL:', {
        accessToken: accessToken ? `${accessToken.substring(0, 20)}...` : null,
        refreshToken: refreshToken ? `${refreshToken.substring(0, 20)}...` : null,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken
      });

      if (accessToken && refreshToken) {
        console.log('💾 Сохранение токенов в localStorage...');
        
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        
        // Проверяем, что токены действительно сохранились
        const savedAccessToken = localStorage.getItem("access_token");
        const savedRefreshToken = localStorage.getItem("refresh_token");
        
        console.log('✅ Токены сохранены в localStorage:', {
          accessTokenSaved: !!savedAccessToken,
          refreshTokenSaved: !!savedRefreshToken,
          accessTokenLength: savedAccessToken?.length,
          refreshTokenLength: savedRefreshToken?.length
        });

        // Удалить токены из URL
        params.delete("access");
        params.delete("refresh");
        const newUrl =
          window.location.pathname +
          (params.toString() ? "?" + params.toString() : "");
        window.history.replaceState({}, document.title, newUrl);
        
        console.log('🧹 Токены удалены из URL, новый URL:', newUrl);
        
        setTokensSaved(true);
        setIsAuthenticated(true);
      } else {
        console.log('⚠️ Токены не найдены в URL или отсутствуют');
        // Проверяем, есть ли уже сохраненные токены
        const existingAccessToken = localStorage.getItem("access_token");
        const existingRefreshToken = localStorage.getItem("refresh_token");
        
        if (existingAccessToken && existingRefreshToken) {
          console.log('✅ Найдены существующие токены в localStorage');
          setIsAuthenticated(true);
        } else {
          console.log('❌ Токены не найдены');
          setIsAuthenticated(false);
        }
      }
      
      setIsLoading(false);
    };

    processTokens();
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, tokensSaved }}>
      {children}
    </AuthContext.Provider>
  );
}; 