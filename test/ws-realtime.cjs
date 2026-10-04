// Step 6.3 live test: gateway subscribe/broadcast + worker -> gateway broadcast.
// NOTE: Nest @SubscribeMessage handlers that return { event, data } EMIT that
// event back; they do not answer the socket.io ack callback. So this test
// listens for events instead of using emitWithAck.
// Usage: node test/ws-realtime.cjs <jwt>
const { io } = require('socket.io-client');
const { Queue } = require('bullmq');

const token = process.argv[2];
if (!token) {
  console.error('Usage: node test/ws-realtime.cjs <jwt>');
  process.exit(2);
}

const results = {};
let queue;
const fail = (msg) => {
  console.error(`FAIL: ${msg}`, JSON.stringify(results, null, 2));
  process.exit(1);
};
const pass = () => {
  console.log(`PASS: ${JSON.stringify(results, null, 2)}`);
  process.exit(0);
};

const socket = io('http://localhost:3000', {
  path: '/ws',
  query: { token },
  transports: ['websocket'],
  timeout: 8000,
});

const timer = setTimeout(() => fail('timed out waiting for anomaly:detected'), 25000);

socket.on('connect_error', (err) => fail(`connect_error: ${err.message}`));

socket.on('subscribed', (data) => {
  results[`subscribed:${data?.channel}`] = data;
  if (data?.channel === 'anomalies' && !results.jobEnqueued) {
    results.jobEnqueued = true;
    void enqueueJob();
  }
  maybeDone();
});

socket.on('ack', (data) => {
  results.ack = data;
  maybeDone();
});

socket.on('cctv:status_changed', (data) => {
  results.cctvStatusChanged = data;
  maybeDone();
});

socket.on('anomaly:detected', (data) => {
  results.anomalyDetected = data;
  maybeDone();
});

function maybeDone() {
  if (
    results['subscribed:anomalies'] &&
    results['subscribed:inspections'] &&
    results.ack === 'location received' &&
    results.cctvStatusChanged &&
    results.anomalyDetected &&
    results.anomalyDetected.anomalyId === results.sentAnomalyId
  ) {
    clearTimeout(timer);
    socket.disconnect();
    queue.close().finally(pass);
  }
}

async function enqueueJob() {
  // Trigger the full worker -> gateway path: enqueue a job the
  // AnomalyProcessWorker picks up and broadcasts.
  queue = new Queue('anomaly-process', {
    connection: { host: 'localhost', port: 6380 },
  });
  results.sentAnomalyId = `ws-test-${Date.now()}`;
  await queue.add('anomaly.detected', {
    anomalyId: results.sentAnomalyId,
    type: 'CCTV_FEED_INTERRUPTED',
    severity: 'HIGH',
  });
}

socket.on('connect', () => {
  results.connected = true;
  socket.emit('subscribe:anomalies', { scope: 'national' });
  socket.emit('subscribe:inspections');
  socket.emit('location:ping', { lat: 28.61, lng: 77.2 });
});
