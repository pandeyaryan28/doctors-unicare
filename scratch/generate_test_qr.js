const QRCode = require('qrcode');

const mockPacket = {
  id: "550e8400-e29b-41d1-a716-446655440000",
  title: "Visit with Dr. Smith - General Checkup",
  expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(), // 1 hour from now
  profile_data: {
    name: "John Doe",
    dob: "1990-01-01T00:00:00.000Z",
    gender: "Male",
    blood_group: "O+",
    abha_id: "12-3456-7890-1234",
    phone: "+91 99999 88888",
    email: "john@example.com",
    address: "Street 45, New Delhi, India"
  },
  medical_history: [
    {
      question_id: "past_history",
      question: "Past medical history",
      answer: "No major illness."
    }
  ],
  records: []
};

// In a real scenario, this would be hosted on a URL.
// For testing, we can encode a JSON string or a data URL (if supported by the scanner).
// Most scanners prefer a real URL.
const packetDataStr = JSON.stringify(mockPacket);
console.log("Mock Packet Data:", packetDataStr);

QRCode.toFile('test-qr.png', 'https://api.example.com/packet/123', function (err) {
  if (err) throw err;
  console.log('Saved test-qr.png. Scan this to test!');
});
