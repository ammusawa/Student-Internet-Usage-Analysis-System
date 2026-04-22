import sys
import os

# Ensure the current directory is in the sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from proxy.proxy import Proxy
import time

if __name__ == '__main__':
    with Proxy(["--plugins", "test_proxy.TestPlugin", "--port", "8899"]):
        print("Proxy started on port 8899 with TestPlugin...")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
