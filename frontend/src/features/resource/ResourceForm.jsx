import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useApi } from "../../hooks/useApi";
import { Field, Input, Textarea, Select, Checkbox, FileInput } from "../../components/ui";

/** Select whose options come from the API, optionally filtered by other form values. */
function AsyncSelect({ field, values, register, error, setValue, currentValue }) {
  const src = field.optionsFrom;
  const params = src.params ? src.params(values) : {};
  const blocked = src.requires && !values[src.requires];
  const { data, loading } = useApi(blocked ? null : src.path, { all: "true", ...params });
  const options = (data || []).map(src.map);

  // Clear the value if it is no longer among the options (e.g. parent changed).
  useEffect(() => {
    if (!loading && data && currentValue && !options.some((o) => String(o.value) === String(currentValue))) {
      setValue(field.name, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data]);

  return (
    <Select
      {...register(field.name, { required: field.required && `${field.label} is required` })}
      options={options}
      error={error}
      disabled={blocked || loading}
      placeholder={blocked ? `Select ${src.requires} first` : loading ? "Loading…" : field.placeholder || "Select…"}
    />
  );
}

function MultiCheck({ field, control, values }) {
  const src = field.optionsFrom;
  const params = src?.params ? src.params(values) : {};
  const { data, loading } = useApi(src ? src.path : null, { all: "true", ...params });
  const options = field.options || (data || []).map(src.map);
  return (
    <Controller
      control={control}
      name={field.name}
      render={({ field: f }) => {
        const val = (f.value || []).map(String);
        const toggle = (id) => f.onChange(val.includes(id) ? val.filter((v) => v !== id) : [...val, id]);
        return (
          <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-300 p-2">
            {loading && <p className="p-2 text-xs text-slate-500">Loading…</p>}
            {!loading && !options.length && <p className="p-2 text-xs text-slate-500">No options available</p>}
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {options.map((o) => (
                <Checkbox key={o.value} label={o.label} checked={val.includes(String(o.value))} onChange={() => toggle(String(o.value))} className="rounded px-2 py-1 hover:bg-slate-50" />
              ))}
            </div>
          </div>
        );
      }}
    />
  );
}

/**
 * Generic form built from a field config.
 * field: { name, label, type, required, options, optionsFrom, rules, colSpan, hint, placeholder, showWhen, accept, multiple }
 */
export function ResourceForm({ id = "resource-form", fields, defaultValues, onSubmit, isEdit }) {
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm({ defaultValues });
  const values = watch();

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        if (field.showWhen && !field.showWhen(values, isEdit)) return null;
        if (field.createOnly && isEdit) return null;
        const err = errors[field.name]?.message;
        const rules = { required: field.required && `${field.label} is required`, ...(field.rules || {}) };
        const span = field.colSpan === 2 || ["textarea", "multiselect", "file"].includes(field.type) ? "sm:col-span-2" : "";
        let control_;
        switch (field.type) {
          case "textarea":
            control_ = <Textarea {...register(field.name, rules)} error={err} rows={field.rows || 4} placeholder={field.placeholder} />;
            break;
          case "select":
            control_ = field.optionsFrom
              ? <AsyncSelect field={field} values={values} register={register} error={err} setValue={setValue} currentValue={values[field.name]} />
              : <Select {...register(field.name, rules)} options={field.options} error={err} placeholder={field.placeholder} />;
            break;
          case "multiselect":
            control_ = <MultiCheck field={field} control={control} values={values} />;
            break;
          case "checkbox":
            control_ = <Checkbox {...register(field.name)} label={field.checkboxLabel || field.label} />;
            break;
          case "file":
            control_ = <FileInput {...register(field.name)} accept={field.accept} multiple={field.multiple} files={values[field.name]} />;
            break;
          default:
            control_ = (
              <Input
                type={field.type || "text"}
                step={field.step}
                min={field.min}
                max={field.max}
                placeholder={field.placeholder}
                error={err}
                {...register(field.name, { ...rules, ...(field.type === "number" ? { valueAsNumber: false } : {}) })}
              />
            );
        }
        return (
          <Field key={field.name} label={field.type === "checkbox" ? null : field.label} required={field.required} error={err} hint={field.hint} className={span}>
            {control_}
          </Field>
        );
      })}
    </form>
  );
}
