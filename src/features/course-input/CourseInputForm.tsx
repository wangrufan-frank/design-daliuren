import { useState, type FormEvent } from "react";
import type { CourseInput, EarthlyBranch } from "../../domain/chart/types";
import { deriveNatalBranch } from "../../domain/chart/natal";
import { parseCourseInput, type InputErrors } from "./schema";

const NATAL_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

export function CourseInputForm({ onSubmit }: { onSubmit: (input: CourseInput) => void }) {
  const [errors, setErrors] = useState<InputErrors>({});
  const [birthYear, setBirthYear] = useState("");
  const [manualNatal, setManualNatal] = useState(false);
  const [manualNatalBranch, setManualNatalBranch] = useState<EarthlyBranch>("子");
  const parsedBirthYear = Number(birthYear);
  const birthYearIsValid = /^\d{4}$/.test(birthYear)
    && parsedBirthYear >= 1900
    && parsedBirthYear <= new Date().getFullYear();
  const automaticNatalBranch = birthYearIsValid ? deriveNatalBranch(parsedBirthYear) : undefined;

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

      <label htmlFor="birthYear">出生年份</label>
      <input
        id="birthYear"
        name="birthYear"
        type="number"
        min={1900}
        max={new Date().getFullYear()}
        required
        value={birthYear}
        aria-describedby={errors.birthYear ? "birthYear-error" : undefined}
        aria-invalid={errors.birthYear ? true : undefined}
        onChange={(event) => setBirthYear(event.currentTarget.value)}
      />
      {errors.birthYear ? <p id="birthYear-error" role="alert">{errors.birthYear}</p> : null}
      {automaticNatalBranch ? (
        <div className="course-input__natal">
          <p>{manualNatal ? `手动选择：${manualNatalBranch}命` : `自动换算：${automaticNatalBranch}命`}</p>
          <button
            type="button"
            onClick={() => {
              if (manualNatal) {
                setManualNatal(false);
              } else {
                setManualNatalBranch(automaticNatalBranch);
                setManualNatal(true);
              }
            }}
          >
            {manualNatal ? "恢复自动换算" : "手动选择本命"}
          </button>
          {manualNatal ? (
            <>
              <label htmlFor="natalBranch">本命地支</label>
              <select
                id="natalBranch"
                name="natalBranch"
                value={manualNatalBranch}
                onChange={(event) => setManualNatalBranch(event.currentTarget.value as EarthlyBranch)}
              >
                {NATAL_BRANCHES.map((branch) => <option key={branch} value={branch}>{branch}命</option>)}
              </select>
            </>
          ) : null}
        </div>
      ) : null}
      {errors.natalBranch ? <p role="alert">{errors.natalBranch}</p> : null}

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

      <button type="submit">生成完整课式</button>
    </form>
  );
}
