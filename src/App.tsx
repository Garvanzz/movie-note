import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { MovieListPage } from "./pages/MovieListPage";
import { MovieDetailPage } from "./pages/MovieDetailPage";
import { ActorListPage } from "./pages/ActorListPage";
import { ActorDetailPage } from "./pages/ActorDetailPage";
import { TagManagementPage } from "./pages/TagManagementPage";
import { GenreManagementPage } from "./pages/GenreManagementPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<MovieListPage />} />
        <Route path="/movies/:code" element={<MovieDetailPage />} />
        <Route path="/actors" element={<ActorListPage />} />
        <Route path="/actors/:id" element={<ActorDetailPage />} />
        <Route path="/actor-categories" element={<Navigate to="/genres" replace />} />
        <Route path="/tags" element={<TagManagementPage />} />
        <Route path="/genres" element={<GenreManagementPage />} />
      </Route>
    </Routes>
  );
}
