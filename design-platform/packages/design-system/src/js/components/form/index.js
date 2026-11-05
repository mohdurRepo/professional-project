import { initClipboardActions } from "./clipboard.js";
import { initFileUploads } from "./file-upload.js";
import { initOtpInputs } from "./otp.js";
import { initPasswordToggles } from "./password-toggle.js";
import { initPhoneCountries } from "./phone.js";

export {
  initClipboardActions,
  initFileUploads,
  initOtpInputs,
  initPasswordToggles,
  initPhoneCountries,
};

export function initForms(root = document) {
  const disposePasswordToggles = initPasswordToggles(root);
  const disposeClipboardActions = initClipboardActions(root);
  const disposeFileUploads = initFileUploads(root);
  const disposeOtpInputs = initOtpInputs(root);
  const disposePhoneCountries = initPhoneCountries(root);

  return () => {
    disposePhoneCountries();
    disposeOtpInputs();
    disposeFileUploads();
    disposeClipboardActions();
    disposePasswordToggles();
  };
}
