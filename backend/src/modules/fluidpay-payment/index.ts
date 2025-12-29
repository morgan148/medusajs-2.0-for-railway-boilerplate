import FluidPayProviderService from "./service"
import { ModuleProviderDefinition } from "@medusajs/framework/types"

const providerDefinition: ModuleProviderDefinition = {
  services: [FluidPayProviderService],
}

export default providerDefinition