import { toast } from "react-toastify";

type NotifyType = "info" | "success" | "warning" | "error";

export function notifyAction(message: string, type: NotifyType = "info") {
  const options = { autoClose: 2500, pauseOnHover: true };
  switch (type) {
    case "success":
      return toast.success(message, options);
    case "warning":
      return toast.warning(message, options);
    case "error":
      return toast.error(message, options);
    default:
      return toast.info(message, options);
  }
}
