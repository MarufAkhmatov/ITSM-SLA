import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { I18nProvider } from "./app/i18n.tsx";
import { PortfolioProvider } from "./app/portfolio.tsx";
import { ThemeProvider } from "./app/theme.tsx";
import { AuthGate } from "./app/components/AuthGate.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <I18nProvider>
      <AuthGate>
        <PortfolioProvider>
          <App />
        </PortfolioProvider>
      </AuthGate>
    </I18nProvider>
  </ThemeProvider>
);
