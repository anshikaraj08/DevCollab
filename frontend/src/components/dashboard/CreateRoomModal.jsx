import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../config/axios";
import getErrorMessage from "../../config/getErrorMessage";
import Button from "../ui/Button";
import Field from "../ui/Field";
import Modal from "../ui/Modal";
import SegmentedControl from "../ui/SegmentedControl";
import { LANGUAGES } from "../ui/LanguageBadge";
 
const OPTIONS = Object.entries(LANGUAGES).map(([value, { label }]) => ({ value, label }));
 
export default function CreateRoomModal({ open, onClose }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
 
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { data } = await api.post("/rooms/create", { title, language });
      navigate(`/room/${data.room._id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not create the workspace"));
      setSaving(false);
    }
  };
 
  return (
    <Modal open={open} onClose={onClose} title="New workspace">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Title" name="title" placeholder="e.g. Binary Search Tree Review" maxLength={100}
          autoFocus value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Language</p>
          <SegmentedControl label="Language" options={OPTIONS} value={language} onChange={setLanguage} />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Create workspace</Button>
        </div>
      </form>
    </Modal>
  );
}

