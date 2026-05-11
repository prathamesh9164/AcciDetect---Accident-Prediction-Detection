import threading
import logging

logger = logging.getLogger(__name__)


def process_video_background(analysis_id, use_gpu=False):
    def run():
        try:
            import torch
            from .video_processor import VideoProcessor
            logger.info(f"Starting video processing for analysis {analysis_id}")
            
            device = 'cpu'
            if use_gpu:
                if torch.cuda.is_available():
                    device = 'cuda'
                else:
                    logger.warning("GPU acceleration requested but CUDA is not available. Falling back to CPU.")
                    
            processor = VideoProcessor(analysis_id, device=device)
            processor.process_video()
            logger.info(f"Video processing completed for analysis {analysis_id}")
        except Exception as e:
            logger.error(f"Error processing video {analysis_id}: {str(e)}", exc_info=True)
    
    thread = threading.Thread(target=run)
    thread.daemon = True
    thread.start()
    logger.info(f"Background thread started for analysis {analysis_id} with GPU={use_gpu}")