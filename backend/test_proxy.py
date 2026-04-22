import os
from proxy.http.proxy import HttpProxyBasePlugin
from typing import Any, Dict, Optional
import logging

class TestPlugin(HttpProxyBasePlugin):
    def on_access_log(self, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        logging.error(f"======== CONTEXT KEYS: {list(context.keys())}")
        logging.error(f"======== CONTEXT VALS: client_ip={context.get('client_ip')}, req_bytes={context.get('request_bytes')}, res_bytes={context.get('response_bytes')}")
        return context
