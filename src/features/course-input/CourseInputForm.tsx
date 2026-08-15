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

      <label htmlFor="locationName">地点</label>
      <input
        id="locationName"
        name="locationName"
        aria-describedby={errors.locationName ? "locationName-error" : undefined}
        aria-invalid={errors.locationName ? true : undefined}
      />
      {errors.locationName ? <p id="locationName-error" role="alert">{errors.locationName}</p> : null}

      <label htmlFor="longitude">经度</label>
      <input
        id="longitude"
        name="longitude"
        type="number"
        step="any"
        aria-describedby={errors.longitude ? "longitude-error" : undefined}
        aria-invalid={errors.longitude ? true : undefined}
      />
      {errors.longitude ? <p id="longitude-error" role="alert">{errors.longitude}</p> : null}

      <label htmlFor="latitude">纬度</label>
      <input
        id="latitude"
        name="latitude"
        type="number"
        step="any"
        aria-describedby={errors.latitude ? "latitude-error" : undefined}
        aria-invalid={errors.latitude ? true : undefined}
      />
      {errors.latitude ? <p id="latitude-error" role="alert">{errors.latitude}</p> : null}

      <button type="submit">建立起课上下文</button>
    </form>
  );
}
