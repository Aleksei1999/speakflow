"use client";

// ---------------------------------------------------------------------------
// Единый телефонный инпут с выбором страны.
//   • <select> стран (флаг + ISO + код), приоритетные страны сверху,
//     остальные по алфавиту (названия через Intl.DisplayNames, ru).
//   • <input type="tel"> форматируется на лету через AsYouType(country).
//   • Ввод «+7…» переключает страну по коду; «8 999…» для RU работает.
//   • onChange отдаёт E.164 («+79991234567») когда номер валиден, иначе "".
//   • Страна по умолчанию: prop defaultCountry → /api/geo → timezone →
//     navigator.language → RU. Гео-запрос делается один раз на страницу.
// Обёртка не стилизуется (кроме flex) — классы инпута/селекта передаются
// из формы, чтобы поле выглядело как соседние.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";

export type PhoneInputMeta = { country: string; valid: boolean };

export type PhoneInputProps = {
  value: string;
  onChange: (e164: string, meta: PhoneInputMeta) => void;
  defaultCountry?: string;
  className?: string;
  inputClassName?: string;
  selectClassName?: string;
  placeholder?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
};

const PRIORITY: CountryCode[] = [
  "RU", "KZ", "BY", "UZ", "KG", "AM", "GE", "AZ", "TR", "UA", "DE", "US", "GB", "AE", "IL", "RS", "ES", "IT", "FR", "PT",
  "NL", "TH", "ID", "VN", "CN", "KR", "JP", "CA", "AU", "PL", "CZ", "LV", "LT", "EE", "FI", "CY", "MD", "TJ", "TM", "MN",
];

const FALLBACK_COUNTRY: CountryCode = "RU";

// timezone → страна (для клиентского фолбэка, когда /api/geo недоступен)
const TZ_TO_COUNTRY: Array<[RegExp, CountryCode]> = [
  [/^Europe\/(Moscow|Kaliningrad|Samara|Volgograd|Saratov|Ulyanovsk|Astrakhan|Kirov)$|^Asia\/(Yekaterinburg|Omsk|Novosibirsk|Barnaul|Tomsk|Novokuznetsk|Krasnoyarsk|Irkutsk|Chita|Yakutsk|Vladivostok|Magadan|Sakhalin|Kamchatka|Anadyr|Srednekolymsk|Khandyga|Ust-Nera)$/, "RU"],
  [/^Asia\/(Almaty|Qyzylorda|Qostanay|Aqtobe|Aqtau|Atyrau|Oral)$/, "KZ"],
  [/^Europe\/Minsk$/, "BY"],
  [/^Asia\/(Tashkent|Samarkand)$/, "UZ"],
  [/^Asia\/Bishkek$/, "KG"],
  [/^Asia\/Yerevan$/, "AM"],
  [/^Asia\/Tbilisi$/, "GE"],
  [/^Asia\/Baku$/, "AZ"],
  [/^Europe\/Istanbul$/, "TR"],
  [/^Europe\/(Kyiv|Kiev|Zaporozhye|Uzhgorod)$/, "UA"],
  [/^Asia\/Dushanbe$/, "TJ"],
  [/^Asia\/Ashgabat$/, "TM"],
  [/^Asia\/(Ulaanbaatar|Hovd|Choibalsan)$/, "MN"],
  [/^Europe\/Chisinau$/, "MD"],
  [/^Europe\/(Riga)$/, "LV"],
  [/^Europe\/(Vilnius)$/, "LT"],
  [/^Europe\/(Tallinn)$/, "EE"],
  [/^Europe\/(Helsinki)$/, "FI"],
  [/^Europe\/(Berlin|Busingen)$/, "DE"],
  [/^Europe\/(London)$/, "GB"],
  [/^Europe\/(Paris)$/, "FR"],
  [/^Europe\/(Madrid)$|^Atlantic\/Canary$|^Africa\/Ceuta$/, "ES"],
  [/^Europe\/(Rome)$/, "IT"],
  [/^Europe\/(Lisbon)$|^Atlantic\/(Madeira|Azores)$/, "PT"],
  [/^Europe\/(Amsterdam)$/, "NL"],
  [/^Europe\/(Warsaw)$/, "PL"],
  [/^Europe\/(Prague)$/, "CZ"],
  [/^Europe\/(Belgrade)$/, "RS"],
  [/^Asia\/(Nicosia|Famagusta)$|^Europe\/Nicosia$/, "CY"],
  [/^Asia\/(Dubai)$/, "AE"],
  [/^Asia\/(Jerusalem|Tel_Aviv)$/, "IL"],
  [/^Asia\/(Bangkok)$/, "TH"],
  [/^Asia\/(Jakarta|Pontianak|Makassar|Jayapura)$/, "ID"],
  [/^Asia\/(Ho_Chi_Minh|Saigon)$/, "VN"],
  [/^Asia\/(Shanghai|Chongqing|Harbin|Urumqi)$/, "CN"],
  [/^Asia\/(Seoul)$/, "KR"],
  [/^Asia\/(Tokyo)$/, "JP"],
  [/^Australia\//, "AU"],
  [/^America\/(Toronto|Vancouver|Montreal|Edmonton|Winnipeg|Halifax|Regina|St_Johns)$/, "CA"],
  [/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.*|Kentucky\/.*|Juneau|Sitka|Nome|Adak)$|^Pacific\/Honolulu$/, "US"],
];

function isCountry(code: string | null | undefined): code is CountryCode {
  if (!code) return false;
  const c = code.toUpperCase();
  return (getCountries() as string[]).includes(c);
}

function flagFor(code: string): string {
  return String.fromCodePoint(...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function detectFromClient(): CountryCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    for (const [re, c] of TZ_TO_COUNTRY) if (re.test(tz)) return c;
  } catch {}
  try {
    const langs = [navigator.language, ...(navigator.languages || [])];
    for (const l of langs) {
      const region = (l.split("-")[1] || "").toUpperCase();
      if (isCountry(region)) return region;
    }
  } catch {}
  return FALLBACK_COUNTRY;
}

// Один гео-запрос на страницу — результат кешируется в модуле.
let geoPromise: Promise<CountryCode | null> | null = null;
function detectFromGeo(): Promise<CountryCode | null> {
  if (!geoPromise) {
    geoPromise = fetch("/api/geo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { country?: string | null } | null) => (isCountry(j?.country) ? (j!.country!.toUpperCase() as CountryCode) : null))
      .catch(() => null);
  }
  return geoPromise;
}

// /api/geo → (если недоступен/пусто) timezone → navigator.language → RU.
function detectCountry(): Promise<CountryCode> {
  return detectFromGeo().then((geo) => geo ?? detectFromClient());
}

let countryOptionsCache: Array<{ code: CountryCode; label: string }> | null = null;
function buildCountryOptions(): Array<{ code: CountryCode; label: string }> {
  if (countryOptionsCache) return countryOptionsCache;
  let names: Intl.DisplayNames | null = null;
  try { names = new Intl.DisplayNames(["ru"], { type: "region" }); } catch {}
  const nameOf = (c: string) => { try { return names?.of(c) || c; } catch { return c; } };
  const all = getCountries();
  const rest = all.filter((c) => !PRIORITY.includes(c)).sort((a, b) => nameOf(a).localeCompare(nameOf(b), "ru"));
  const ordered = [...PRIORITY.filter((c) => all.includes(c)), ...rest];
  countryOptionsCache = ordered.map((code) => ({ code, label: `${flagFor(code)} ${code} +${getCountryCallingCode(code)}` }));
  return countryOptionsCache;
}

function formatFor(country: CountryCode, text: string): { display: string; e164: string; valid: boolean; country: CountryCode } {
  const f = new AsYouType(country);
  const display = f.input(text);
  const num = f.getNumber();
  const detected = f.getCountry() ?? (num?.country as CountryCode | undefined) ?? country;
  const valid = !!num && num.isValid();
  return { display, e164: valid ? num!.number : "", valid, country: detected };
}

export function PhoneInput({
  value,
  onChange,
  defaultCountry,
  className,
  inputClassName,
  selectClassName,
  placeholder = "номер телефона",
  name = "phone",
  required,
  disabled,
  id,
}: PhoneInputProps) {
  const [country, setCountry] = useState<CountryCode>(() => (isCountry(defaultCountry) ? (defaultCountry.toUpperCase() as CountryCode) : FALLBACK_COUNTRY));
  const [text, setText] = useState("");
  // Последний отданный наружу E.164 — чтобы отличать наш же value от внешнего сброса.
  const [lastEmitted, setLastEmitted] = useState("");
  const touched = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const options = useMemo(() => buildCountryOptions(), []);

  // Смена prop defaultCountry — подстраиваем состояние прямо в рендере (паттерн «derive state from props»).
  const [prevDefault, setPrevDefault] = useState(defaultCountry);
  if (defaultCountry !== prevDefault) {
    setPrevDefault(defaultCountry);
    if (isCountry(defaultCountry)) setCountry(defaultCountry.toUpperCase() as CountryCode);
  }

  // Внешний сброс/установка value (например form.reset() → '') — тоже в рендере.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== lastEmitted) {
      if (!value) {
        setText("");
        setLastEmitted("");
      } else {
        const r = formatFor(country, value);
        setText(r.display);
        if (r.country !== country) setCountry(r.country);
        setLastEmitted(r.e164);
      }
    }
  }

  // Автоопределение страны (если явно не задана и пользователь ещё ничего не ввёл).
  useEffect(() => {
    if (isCountry(defaultCountry)) return;
    let alive = true;
    detectCountry().then((c) => {
      if (alive && !touched.current) setCountry(c);
    });
    return () => { alive = false; };
  }, [defaultCountry]);

  function emit(e164: string, c: CountryCode, valid: boolean) {
    setLastEmitted(e164);
    onChangeRef.current(e164, { country: c, valid });
  }

  function onInput(e: ChangeEvent<HTMLInputElement>) {
    touched.current = true;
    let next = e.target.value;
    // Backspace по служебному символу маски («)», «-», пробел): AsYouType вернул бы
    // тот же текст — срезаем последнюю цифру, чтобы удаление ощущалось естественно.
    const prevDigits = text.replace(/\D/g, "");
    const nextDigits = next.replace(/\D/g, "");
    if (next.length < text.length && nextDigits === prevDigits && prevDigits.length > 0) {
      next = next.replace(/\d(?!.*\d)/, "");
    }
    if (!next.trim()) { setText(""); emit("", country, false); return; }
    const r = formatFor(country, next);
    setText(r.display);
    if (r.country !== country) setCountry(r.country);
    emit(r.e164, r.country, r.valid);
  }

  function onSelect(e: ChangeEvent<HTMLSelectElement>) {
    touched.current = true;
    const c = e.target.value as CountryCode;
    setCountry(c);
    // Переносим введённый национальный номер в новую страну.
    const cur = parsePhoneNumberFromString(text, country);
    const national = cur ? cur.nationalNumber : text.replace(/\D/g, "");
    if (!national) { setText(""); emit("", c, false); return; }
    const r = formatFor(c, national);
    setText(r.display);
    emit(r.e164, c, r.valid);
  }

  // Одно поле: селект страны лежит внутри пилюли инпута слева, инпут получает
  // отступ по реальной ширине селекта.
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const [selectWidth, setSelectWidth] = useState(96);
  useEffect(() => {
    const el = selectRef.current;
    if (!el) return;
    const measure = () => setSelectWidth(Math.ceil(el.getBoundingClientRect().width));
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [country]);

  return (
    <div className={["phone-input", className].filter(Boolean).join(" ")} style={{ position: "relative", display: "block", width: "100%" }}>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        className={inputClassName}
        placeholder={placeholder}
        value={text}
        onChange={onInput}
        required={required}
        disabled={disabled}
        style={{ display: "block", width: "100%", boxSizing: "border-box", paddingLeft: selectWidth + 22 }}
      />
      <select
        ref={selectRef}
        className={selectClassName}
        value={country}
        onChange={onSelect}
        disabled={disabled}
        aria-label="Страна"
        style={{
          position: "absolute",
          left: 14,
          top: "50%",
          transform: "translateY(-50%)",
          width: "auto",
          height: "auto",
          maxWidth: "45%",
          margin: 0,
          padding: "4px 2px 4px 6px",
          border: 0,
          background: "transparent",
          font: "inherit",
          cursor: "pointer",
          outline: "none",
        }}
      >
        {options.map((o) => (
          <option key={o.code} value={o.code}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export default PhoneInput;
