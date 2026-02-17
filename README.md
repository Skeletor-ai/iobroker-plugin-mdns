# @iobroker/plugin-mdns

ioBroker plugin for mDNS/Bonjour service advertisement. Makes any adapter auto-discoverable on the local network.

Uses [@homebridge/ciao](https://github.com/homebridge/ciao) — a RFC 6762/6763 compliant mDNS responder that passes Apple's Bonjour Conformance Test.

## Installation

Add to your adapter's `package.json`:

```json
"dependencies": {
    "@iobroker/plugin-mdns": "^1.0.0"
}
```

## Configuration

Add to your adapter's `io-package.json` under `common`:

### Simple (fixed port)

```json
"plugins": {
    "mdns": {
        "enabled": true,
        "serviceType": "iobroker-ai",
        "port": 8089,
        "txt": {
            "path": "/audio",
            "version": "1"
        }
    }
}
```

### Auto-detect port from adapter config

```json
"plugins": {
    "mdns": {
        "enabled": true,
        "serviceType": "iobroker-ai",
        "portKey": "audioPort",
        "defaultPort": 8089
    }
}
```

The plugin reads the port from the adapter's `native` configuration using the specified `portKey`.

## Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `enabled` | boolean | no | `true` | Enable/disable the plugin |
| `serviceType` | string | no | `iobroker-<adapter>` | mDNS service type (without `_` prefix and `._tcp` suffix) |
| `port` | number | no* | — | Fixed port to advertise |
| `portKey` | string | no* | — | Key in adapter's native config to read port from |
| `defaultPort` | number | no | — | Fallback port if `portKey` is not set |
| `serviceName` | string | no | `ioBroker <adapter> (<hostname>)` | Human-readable service name |
| `txt` | object | no | `{}` | Additional TXT record fields |

\* Either `port` or `portKey` (with `defaultPort`) should be provided.

## How it works

1. When the adapter starts, the plugin publishes an mDNS service on the local network
2. Clients (mobile apps, other devices) can discover the service using standard mDNS/DNS-SD queries
3. The service type follows the pattern `_<serviceType>._tcp`
4. When the adapter stops, the service is automatically unpublished

## Discovery from clients

### Android (NsdManager)

```kotlin
val nsdManager = getSystemService(Context.NSD_SERVICE) as NsdManager
nsdManager.discoverServices("_iobroker-ai._tcp.", NsdManager.PROTOCOL_DNS_SD, listener)
```

### Node.js (bonjour-service)

```javascript
const { Bonjour } = require('bonjour-service');
const bonjour = new Bonjour();
bonjour.find({ type: 'iobroker-ai' }, (service) => {
    console.log(`Found: ${service.name} at ${service.host}:${service.port}`);
});
```

### Python (zeroconf)

```python
from zeroconf import ServiceBrowser, Zeroconf

class Listener:
    def add_service(self, zc, type_, name):
        info = zc.get_service_info(type_, name)
        print(f"Found: {info.server}:{info.port}")

zc = Zeroconf()
browser = ServiceBrowser(zc, "_iobroker-ai._tcp.local.", Listener())
```

### CLI (avahi/mdns)

```bash
# Linux
avahi-browse -r _iobroker-ai._tcp

# macOS
dns-sd -B _iobroker-ai._tcp
```

## TXT Records

The plugin automatically includes these TXT records:

| Key | Value |
|-----|-------|
| `adapter` | Adapter name |
| `hostname` | System hostname |

Additional records can be added via the `txt` config option.

## Example: ai-assistant adapter

```json
{
    "common": {
        "name": "ai-assistant",
        "plugins": {
            "mdns": {
                "enabled": true,
                "serviceType": "iobroker-ai",
                "portKey": "audioPort",
                "defaultPort": 8089,
                "txt": {
                    "path": "/audio",
                    "version": "1"
                }
            }
        }
    }
}
```

This publishes `_iobroker-ai._tcp` on the configured audio port, allowing the Kalima Android app to auto-discover the server.

## License

MIT
