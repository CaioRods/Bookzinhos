import { createBrowserRouter } from "react-router";
import { AuthWrapper } from "./components/AuthWrapper";
import { ErrorScreen } from "./components/ErrorScreen";
import { RootLayout } from "./components/RootLayout";
import { Home } from "./pages/Home";

/**
 * Só a home entra no pacote inicial. As demais telas são carregadas sob
 * demanda pelo `lazy` do próprio roteador — o leitor de PDF, por exemplo,
 * arrasta o pdf.js junto e não deveria pesar na primeira abertura do app.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    Component: AuthWrapper,
    // Uma tela que quebra não deve virar página branca: o erro sobe até aqui.
    ErrorBoundary: ErrorScreen,
    children: [
      {
        path: "/",
        Component: RootLayout,
        ErrorBoundary: ErrorScreen,
        children: [
          { index: true, Component: Home },
          { path: "series/:seriesId", lazy: async () => ({ Component: (await import("./components/SeriesShelf")).SeriesPage }) },
          { path: "library", lazy: async () => ({ Component: (await import("./pages/Library")).Library }) },
          { path: "my-books", lazy: async () => ({ Component: (await import("./pages/MyBooks")).MyBooks }) },
          { path: "notes", lazy: async () => ({ Component: (await import("./pages/Notes")).Notes }) },
          { path: "profile", lazy: async () => ({ Component: (await import("./pages/Profile")).Profile }) },
          { path: "book/:id", lazy: async () => ({ Component: (await import("./pages/BookDetails")).BookDetails }) },
          { path: "upload", lazy: async () => ({ Component: (await import("./pages/Upload")).Upload }) },
          { path: "social/post/:postId", lazy: async () => ({ Component: (await import("./components/Community")).PostPage }) },
          { path: "social", lazy: async () => ({ Component: (await import("./pages/Social")).Social }) },
          { path: "admin", lazy: async () => ({ Component: (await import("./pages/Admin")).Admin }) },
          { path: "settings", lazy: async () => ({ Component: (await import("./pages/Settings")).Settings }) },
          { path: "user/:username", lazy: async () => ({ Component: (await import("./pages/UserProfile")).UserProfile }) },
          { path: "chat/:otherUser", lazy: async () => ({ Component: (await import("./pages/Chat")).Chat }) },
          { path: "read/:id", lazy: async () => ({ Component: (await import("./pages/BookReader")).BookReader }) },
        ],
      },
    ],
  },
]);
