import { useRef, useState, type FormEvent } from "react";
import type { CourseInput, EarthlyBranch } from "../../domain/chart/types";
import { deriveNatalBranch } from "../../domain/chart/natal";
import { parseCourseInput, type InputErrors } from "./schema";

import "./course-entry.css";

const NATAL_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

export function CourseInputForm({ onSubmit }: { onSubmit: (input: CourseInput) => void }) {
  const dateTimeRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState("");
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
      for (const name of ["civilDateTime", "birthYear", "natalBranch", "reason"] as const) {
        const field = event.currentTarget.elements.namedItem(name);
        if (result[name] && field instanceof HTMLElement) {
          field.focus();
          break;
        }
      }
      return;
    }

    setErrors({});
    onSubmit(result);
  }

  return (
    <form className="course-input" onSubmit={submit} noValidate>
      <fieldset><legend>起课时间 <small>必填</small></legend>
      <label htmlFor="civilDateTime">日期与时间</label>
      <input
        ref={dateTimeRef}
        required
        id="civilDateTime"
        name="civilDateTime"
        type="datetime-local"
        step={60}
        min="1900-01-01T00:00"
        max="2100-12-31T23:59"
        aria-describedby={errors.civilDateTime ? "civilDateTime-error" : undefined}
        aria-invalid={errors.civilDateTime ? true : undefined}
      />
      {errors.civilDateTime ? <p id="civilDateTime-error" role="alert">{errors.civilDateTime}</p> : null}

      <div className="course-input__time-help"><span>按北京时间填写，精确到分钟</span><button type="button" onClick={() => {
        if (dateTimeRef.current) dateTimeRef.current.value = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
      }}>使用当前时间</button></div>
      </fieldset>
      <fieldset><legend>本命信息 <small>必填</small></legend>
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

      </fieldset>
      <fieldset><legend>事由与地点</legend>
      <p className="course-input__hint">事由必填，地点可留空。</p>
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
        value={reason}
        onChange={(event) => setReason(event.currentTarget.value)}
        aria-describedby={errors.reason ? "reason-error" : undefined}
        aria-invalid={errors.reason ? true : undefined}
      />
      <p className="course-input__count" aria-live="polite">{reason.length} / 120 字</p>
      {errors.reason ? <p id="reason-error" role="alert">{errors.reason}</p> : null}

      </fieldset>
      <button type="submit">生成完整课式</button>
    </form>
  );
}
