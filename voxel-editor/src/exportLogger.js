const LOG_PREFIX = '[Greenscreen Export]'

const formatDetails = (details) => {
  if (!details) return ''
  try {
    return JSON.stringify(details)
  } catch {
    return String(details)
  }
}

export function formatExportLog(entries) {
  return entries
    .map((entry) => {
      const details = formatDetails(entry.details)
      return details
        ? `${entry.time} ${entry.level.toUpperCase()} ${entry.event} ${details}`
        : `${entry.time} ${entry.level.toUpperCase()} ${entry.event}`
    })
    .join('\n')
}

export function createExportLogger(onChange) {
  const entries = []
  const groupLabel = `${LOG_PREFIX} ${new Date().toISOString()}`

  if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(groupLabel)
  } else {
    console.info(groupLabel)
  }

  const emit = (level, event, details) => {
    const entry = {
      time: new Date().toISOString(),
      level,
      event,
      details,
    }
    entries.push(entry)
    onChange?.(formatExportLog(entries))

    const method = level === 'error' ? console.error : console.info
    method(`${LOG_PREFIX} ${event}`, details ?? '')
  }

  return {
    info: (event, details) => emit('info', event, details),
    error: (event, details) => emit('error', event, details),
    text: () => formatExportLog(entries),
    finish: () => {
      emit('info', 'log finished')
      if (typeof console.groupEnd === 'function') {
        console.groupEnd()
      }
    },
  }
}
