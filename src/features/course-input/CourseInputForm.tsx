import { useState, type FormEvent } from "react";
import type { CourseInput } from "../../domain/chart/types";
import { parseCourseInput, type InputErrors } from "./schema";

const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

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
      <input id="civilDateTime" name="civilDateTime" type="datetime-local" aria-describedby="civilDateTime-error" />
      <p id="civilDateTime-error" role="alert">{errors.civilDateTime}</p>

      <label htmlFor="locationName">地点</label>
      <input id="locationName" name="locationName" />
      <p id="locationName-error" role="alert">{errors.locationName}</p>

      <label htmlFor="longitude">经度</label>
      <input id="longitude" name="longitude" type="number" step="any" />
      <p role="alert">{errors.longitude}</p>

      <label htmlFor="latitude">纬度</label>
      <input id="latitude" name="latitude" type="number" step="any" />
      <p role="alert">{errors.latitude}</p>

      {(["monthGeneral", "divinationHour"] as const).map((name) => (
        <label key={name}>
          {name === "monthGeneral" ? "月将" : "占时"}
          <select name={name} defaultValue="">
            <option value="">自动换算</option>
            {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
          </select>
        </label>
      ))}

      <button type="submit">建立起课上下文</button>
    </form>
  );
}
