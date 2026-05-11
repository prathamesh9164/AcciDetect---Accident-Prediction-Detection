import logging
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)

def send_accident_alert(analysis_id, frame_idx):
    try:
        # Email Alert
        subject = f"🚨 URGENT: Accident Detected (Analysis {analysis_id})"
        message = f"An accident has been detected by AcciDetect at frame {frame_idx}.\n\nPlease review the system dashboard immediately."
        
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'alerts@accidetect.local'),
            recipient_list=[getattr(settings, 'ALERT_EMAIL', 'admin@accidetect.local')],
            fail_silently=True,
        )
        logger.info(f"Alert email triggered for Analysis {analysis_id}.")

        # SMS Alert (Twilio)
        twilio_account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', None)
        twilio_auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', None)
        twilio_from_number = getattr(settings, 'TWILIO_FROM_NUMBER', None)
        twilio_to_number = getattr(settings, 'TWILIO_TO_NUMBER', None)

        if twilio_account_sid and twilio_auth_token and twilio_to_number:
            try:
                from twilio.rest import Client
                client = Client(twilio_account_sid, twilio_auth_token)
                sms_body = f"🚨 AcciDetect Alert: Accident detected in Analysis {analysis_id} at frame {frame_idx}. Check dashboard."
                message = client.messages.create(
                    body=sms_body,
                    from_=twilio_from_number,
                    to=twilio_to_number
                )
                logger.info(f"Alert SMS sent! SID: {message.sid}")
            except ImportError:
                logger.warning("Twilio library not installed. Skipping SMS.")
            except Exception as e:
                logger.error(f"Failed to send SMS: {e}")
        else:
            logger.info("Twilio settings not configured. Skipping SMS alert.")

    except Exception as e:
        logger.error(f"Failed to send accident alert: {e}")
