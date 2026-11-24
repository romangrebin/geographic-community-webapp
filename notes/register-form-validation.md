# Register form validation messaging

`components/RegisterSheet.tsx` disables "Register community" (`canSubmit`) until all of these are true:
- name is filled in
- at least one contact is given (a website, or an email from the signed-in account)
- the website is valid
- the boundary passes `drawError`
- if Type = "Other", its free-text type field is filled in

Every one of these needs a visible hint, or the disabled button looks unexplained.

## 2026-11-24: "Other" type hint + neutral sign-in tip
- Bug: with "Other" selected and its text field empty, the button was disabled with no explanation. The only text near it was the sign-in tip, shown in red, so it looked like signing in was required.
- Fix: an amber inline hint ("Describe what type of community this is.") under the empty Other input, styled like the existing contact hint.
- The sign-in tip went from `text-red-400` to neutral `text-ink-5`, because signing in is optional. Red is kept for things that actually block submission.
- Other options considered: a "still needed" checklist above the button, or an always-enabled button that validates on click. The user chose the inline hint.

## 2026-11-24: red error hint, shown only once the user skips the field
- The hint now matches the website-error style: small red text (`text-xs text-red-500`) and a red border on the input. A version with a bold red box, ⚠ and a 2px border was too loud for the user. It starts hidden. `hasSkippedOtherType` turns it on when either of these happens while "Other" is still empty:
  - the user types in a field below it (Description or Website)
  - the user clicks Register. This also focuses the input, which scrolls it into view.
- It hides again once the field is filled. Clicking either Type button resets the flag.
- To make the Register click reachable, the button no longer uses the `disabled` attribute (except while submitting). It uses `aria-disabled`, keeps the dimmed look, and `handleSubmit` refuses to submit until `canSubmit` is true.
- `required` was removed from the Other input. Otherwise the browser's built-in validation would block the submit and show its own tooltip before our handler ran.
- Side effect: Name still has `required`. Clicking Register with Name empty now shows the browser's "Please fill out this field" tooltip; before, the click did nothing.
- Wording: "Please enter a community type." The field takes a short label, and "describe" sounded like a sentence and overlapped with the Description field.
