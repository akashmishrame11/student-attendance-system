export function ok(res, data, message = "Success", meta) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(200).json(body);
}

export function created(res, data, message = "Created successfully") {
  return res.status(201).json({ success: true, message, data });
}
