const bookingForm = document.querySelector('#bookingForm');
const formStatus = document.querySelector('#formStatus');
const preferredDate = document.querySelector('#preferredDate');
const submitButton = bookingForm?.querySelector('button[type="submit"]');

if (preferredDate) {
  preferredDate.min = new Date().toISOString().split('T')[0];
}

function getFieldValue(formData, fieldName) {
  return formData.get(fieldName)?.toString().trim() || '';
}

function buildBookingPayload(formData) {
  return {
    customerName: getFieldValue(formData, 'customerName'),
    customerEmail: getFieldValue(formData, 'customerEmail'),
    customerPhone: getFieldValue(formData, 'customerPhone'),
    serviceAddress: getFieldValue(formData, 'serviceAddress'),
    serviceType: getFieldValue(formData, 'serviceType'),
    preferredDate: getFieldValue(formData, 'preferredDate'),
    preferredTime: getFieldValue(formData, 'preferredTime'),
    jobNotes: getFieldValue(formData, 'jobNotes'),
    smsConsent: formData.get('smsConsent') === 'on',
  };
}

function setFormStatus(message, type = 'info') {
  formStatus.textContent = message;
  formStatus.dataset.status = type;
}

function getBookingEndpoint() {
  return window.FreddiePressureConfig?.bookingEndpoint || '';
}

function isConfiguredEndpoint(endpoint) {
  return endpoint && !endpoint.includes('YOUR_PROJECT_REF');
}

async function handleBookingSubmit(event) {
  event.preventDefault();

  const endpoint = getBookingEndpoint();
  if (!isConfiguredEndpoint(endpoint)) {
    setFormStatus('The booking service is not connected yet. Please update js/config.js with your Supabase function URL.', 'error');
    return;
  }

  submitButton.disabled = true;
  setFormStatus('Submitting your request for review...', 'info');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBookingPayload(new FormData(bookingForm))),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Unable to submit request.');
    }

    bookingForm.reset();
    if (preferredDate) {
      preferredDate.min = new Date().toISOString().split('T')[0];
    }
    setFormStatus(result.message || 'Request received. We will text you after review.', 'success');
  } catch (error) {
    setFormStatus(error.message || 'Something went wrong. Please try again.', 'error');
  } finally {
    submitButton.disabled = false;
  }
}

if (bookingForm) {
  bookingForm.addEventListener('submit', handleBookingSubmit);
}
