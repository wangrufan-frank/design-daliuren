import { useState, type FormEvent } from "react";
import type { CourseInput } from "../../domain/chart/types";
import { parseCourseInput, type InputErrors } from "./schema";

export function CourseInputForm({ onSubmit }: { onSubmit: (input: CourseInput) => void }) {
  const [errors, setErrors] = useState<InputErrors>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parseCourseInput(new FormData(event.currentTarget));

    if (!("corrections" in result)) {
      setErrors(result);
      return;
    }

    setErrors({});
    onSubmit(result);
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="civilDateTime">日期与时间</label>
      <input
        id="civilDateTime"
        name="civilDateTime"
        type="datetime-local"
        step={1}
        min="1900-01-01T00:00:00"
        max="2100-12-31T23:59:59"
        aria-describedby={errors.civilDateTime ? "civilDateTime-error" : undefined}
        aria-invalid={errors.civilDateTime ? true : undefined}
      />
      {errors.civilDateTime ? <p id="civilDateTime-error" role="alert">{errors.civilDateTime}</p> : null}

      <label htmlFor="locationName">地点（选填）</label>
      <input
        id="locationName"
        name="locationName"
      />

      <label htmlFor="reason">起课事由</label>
      <textarea
        id="reason"
        name="reason"
        required
        maxLength={120}
        aria-describedby={errors.reason ? "reason-error" : undefined}
        aria-invalid={errors.reason ? true : undefined}
      />
      {errors.reason ? <p id="reason-error" role="alert">{errors.reason}</p> : null}

      <button type="submit">建立起课上下文</button>
    </form>
  );
}
