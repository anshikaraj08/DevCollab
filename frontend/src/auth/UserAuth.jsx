import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { UserContext } from "../context/user.context";
import PageLoader from "../components/PageLoader";

export default function UserAuth({ children }) {
  const { user, loading } = useContext(UserContext);
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
