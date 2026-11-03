// Turns any axios error into a message a user can understand
export default function getErrorMessage(err, fallback = "Something went wrong") {
    if (!err.response) {
        return "Cannot reach the server. Check that the backend is running.";
    }
    return err.response.data?.message || fallback;
}
