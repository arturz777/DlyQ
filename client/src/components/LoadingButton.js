import React from "react";
import { Button, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";

const LoadingButton = React.forwardRef(
  (
    {
      loading = false,
      loadingText,
      spinner = true,
      spinnerPlacement = "left",
      minWidth = 200,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation();
    const isDisabled = Boolean(disabled || loading);

    const SpinnerEl = spinner ? (
      <Spinner
        as="span"
        animation="border"
        size="sm"
        role="status"
        aria-hidden="true"
        style={{
          marginRight: spinnerPlacement === "left" ? 10 : 0,
          marginLeft: spinnerPlacement === "right" ? 10 : 0,
          verticalAlign: -2,
        }}
      />
    ) : null;

    const text = loadingText ?? t("Loading...", { ns: "devicePage" });

    return (
      <Button
        ref={ref}
        {...props}
        type={props.type || "button"}
        disabled={isDisabled}
        aria-busy={loading ? "true" : "false"}
        style={{ minWidth, ...(props.style || {}) }}
      >
        {loading ? (
          <>
            {spinnerPlacement === "left" ? SpinnerEl : null}
            <span>{text}</span>
            {spinnerPlacement === "right" ? SpinnerEl : null}
          </>
        ) : (
          <span>{children}</span>
        )}
      </Button>
    );
  }
);

export default LoadingButton;
