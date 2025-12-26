import React from "react";
import Spinner from "react-bootstrap/Spinner";

const CheckIcon = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden="true"
    style={{ display: "block" }}
  >
    <path
      d="M20 6L9 17l-5-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LoadingIconButton = ({
  loading = false,
  success = false,
  className = "",
  disabled,
  children,
  spinnerVariant = "primary",
  ...props
}) => {
  const isDisabled = Boolean(disabled || loading || success);

  return (
    <button
      type="button"
      className={className}
      disabled={isDisabled}
      aria-busy={loading ? "true" : "false"}
      {...props}
    >
      {loading ? (
        <Spinner
          animation="border"
          size="sm"
          variant={spinnerVariant}
          style={{ width: 18, height: 18, borderWidth: 2 }}
        />
      ) : success ? (
        <span style={{ color: "#0072CE" }}>
          <CheckIcon size={18} />
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default LoadingIconButton;
