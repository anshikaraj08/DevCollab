import { useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { UserContext } from "../../context/user.context";
import { useLogout } from "../../hooks/useLogout";
import Avatar from "../ui/Avatar";
 
export default function UserMenu() {
  const { user } = useContext(UserContext);
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
 
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
 
  if (!user) return null;
  return (
    <div ref={ref} className="relative">
      <button
        type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}
        className="flex cursor-pointer items-center gap-2 rounded-full p-1 pr-3 transition hover:bg-surface-2"
      >
        <Avatar name={user.name} />
        <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-48 rounded-xl border border-line bg-surface p-1 shadow-xl">
          <Link role="menuitem" to="/dashboard" onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm text-fg hover:bg-surface-2">
            Workspaces
          </Link>
          <button role="menuitem" type="button" onClick={logout}
            className="block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-surface-2">
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

