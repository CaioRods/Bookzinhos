import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

export function ProfileBackButton() {
  const navigate = useNavigate();

  function goBack() {
    if (window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  }

  return (
    <button type="button" className="mb-btn mb-btn-ghost mb-profile-back" data-public-back onClick={goBack}>
      <ArrowLeft size={18} aria-hidden="true" />
      Voltar
    </button>
  );
}
