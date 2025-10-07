const { Kafka } = require('kafkajs');

async function testKafkaConnection() {
  const kafka = new Kafka({
    clientId: 'test-client',
    brokers: ['localhost:9092'],
  });

  const admin = kafka.admin();

  try {
    console.log('Connecting to Kafka...');
    await admin.connect();
    console.log('Connected successfully!');

    const topics = await admin.listTopics();
    console.log('Available topics:', topics);

    await admin.disconnect();
    console.log('Disconnected successfully');
  } catch (error) {
    console.error('Kafka connection failed:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('Kafka is not accessible on localhost:9092');
      console.error('Try using 127.0.0.1:9092 instead');
    }
  }
}

testKafkaConnection();
