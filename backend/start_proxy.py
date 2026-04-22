import sys
import os

# Ensure the current directory is in the sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from proxy.proxy import Proxy
import time
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("TrafficLogger")

if __name__ == '__main__':
    # Start proxy with our plugin on port 8899
    # Setting bind to 0.0.0.0 to allow other devices to connect
    cmd_args = ["--plugins", "app_proxy.StudentUsagePlugin", "--port", "8899", "--hostname", "0.0.0.0"]
    
    logger.info("Starting Student Internet Usage Proxy Server on 0.0.0.0:8899")
    logger.info("Make sure students point their device's HTTP/HTTPS proxy to this PC's IP address on port 8899.")
    
    with Proxy(cmd_args):
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Shutting down Proxy Server...")
