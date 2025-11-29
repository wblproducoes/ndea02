let io
function init(socketServer) { io = socketServer }
function emitStatusUpdate(payload) { if (io) io.emit('statusUpdate', payload) }
function emitDataRefresh(payload) { if (io) io.emit('dataRefresh', payload || {}) }
function emitCounterUpdate(payload) { if (io) io.emit('counterUpdate', payload) }
function emitTableRenamed(payload) { if (io) io.emit('tableRenamed', payload) }
module.exports = { init, emitStatusUpdate, emitDataRefresh, emitCounterUpdate, emitTableRenamed }
