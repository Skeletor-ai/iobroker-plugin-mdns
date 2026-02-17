import { PluginBase } from '@iobroker/plugin-base';
import type { CiaoService, Responder } from '@homebridge/ciao';
import os from 'os';

/**
 * Configuration for the mDNS plugin.
 *
 * Example in io-package.json:
 * ```json
 * "plugins": {
 *     "mdns": {
 *         "enabled": true,
 *         "serviceType": "iobroker-ai",
 *         "port": 8089,
 *         "txt": { "path": "/audio", "version": "1" }
 *     }
 * }
 * ```
 *
 * Or with auto-detection (reads port from adapter native config):
 * ```json
 * "plugins": {
 *     "mdns": {
 *         "enabled": true,
 *         "portKey": "audioPort",
 *         "defaultPort": 8089
 *     }
 * }
 * ```
 */
interface MdnsPluginConfig {
    enabled?: boolean;

    /** Service type without underscore prefix and ._tcp suffix (e.g. "iobroker-ai") */
    serviceType?: string;

    /** Fixed port number */
    port?: number;

    /** Key in adapter's native config to read port from (e.g. "audioPort") */
    portKey?: string;

    /** Default port if portKey is not set in native config */
    defaultPort?: number;

    /** Service name (default: "ioBroker <adapterName> (<hostname>)") */
    serviceName?: string;

    /** Additional TXT record fields */
    txt?: Record<string, string>;
}

class MdnsPlugin extends PluginBase {
    private responder: Responder | null = null;
    private service: CiaoService | null = null;

    /**
     * Initialize and publish the mDNS service.
     */
    async init(pluginConfig: MdnsPluginConfig): Promise<void> {
        if (!pluginConfig.enabled) {
            this.log.info('mDNS plugin disabled by user');
            return;
        }

        // Determine service type
        const adapterName = this.getAdapterName();
        const serviceType = pluginConfig.serviceType || `iobroker-${adapterName}`;

        // Determine port
        let port = pluginConfig.port;
        if (!port && pluginConfig.portKey) {
            port = this.getPortFromConfig(pluginConfig.portKey);
        }
        if (!port && pluginConfig.defaultPort) {
            port = pluginConfig.defaultPort;
        }
        if (!port) {
            this.log.warn('mDNS plugin: no port configured. Set "port", "portKey", or "defaultPort" in plugin config.');
            return;
        }

        // Determine service name
        const hostname = os.hostname();
        const serviceName = pluginConfig.serviceName || `ioBroker ${adapterName} (${hostname})`;

        // Build TXT records
        const txt: Record<string, string> = {
            adapter: adapterName,
            hostname: hostname,
            ...(pluginConfig.txt || {}),
        };

        // Publish via @homebridge/ciao (RFC 6762/6763 compliant)
        try {
            const ciao = await import('@homebridge/ciao');
            this.responder = ciao.getResponder();

            this.service = this.responder.createService({
                name: serviceName,
                type: serviceType,
                port: port,
                txt: txt,
            });

            await this.service.advertise();

            this.log.info(`mDNS service published: _${serviceType}._tcp on port ${port} as "${serviceName}"`);
        } catch (err: any) {
            this.log.error(`mDNS plugin failed to publish service: ${err.message}`);
        }
    }

    /**
     * Clean up: unpublish service and shutdown responder.
     */
    async destroy(): Promise<boolean> {
        if (this.service) {
            try {
                await this.service.end();
            } catch (_) {
                // ignore
            }
            this.service = null;
        }

        if (this.responder) {
            try {
                await this.responder.shutdown();
            } catch (_) {
                // ignore
            }
            this.responder = null;
        }

        this.log.debug('mDNS plugin destroyed');
        return true;
    }

    /**
     * Extract adapter name from the plugin namespace.
     * Namespace format: system.adapter.<name>.<instance>.plugins.mdns
     */
    private getAdapterName(): string {
        const ns = this.pluginNamespace || '';
        const match = ns.match(/system\.adapter\.([^.]+)\./);
        return match ? match[1] : 'unknown';
    }

    /**
     * Read a port value from the adapter's native configuration.
     */
    private getPortFromConfig(portKey: string): number | undefined {
        try {
            const native = (this.parentIoPackage as any)?.native;
            if (native && typeof native[portKey] === 'number') {
                return native[portKey];
            }
        } catch (_) {
            // ignore
        }
        return undefined;
    }
}

export = MdnsPlugin;
