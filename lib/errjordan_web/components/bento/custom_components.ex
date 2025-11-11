defmodule ErrjordanWeb.BentoCustomComponents do
  @moduledoc """
  Components for customer-specific Bento routes.
  """

  use ErrjordanWeb, :html

  alias ErrjordanWeb.BentoSharedComponents, as: Shared

  attr :route, :map, required: true
  attr :content, :map, required: true

  def render(assigns) do
    ~H"""
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-rose-600">Custom View</p>
          <h1 class="text-2xl font-semibold text-gray-900">{@content.title}</h1>
          <p class="text-sm text-gray-500">{@content.boundary.highlight}</p>
        </div>
        <Shared.status_pill status={:watch} label="Adaptive" />
      </header>

      <div class="grid gap-4 md:grid-cols-3">
        <div class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p class="text-xs uppercase tracking-widest text-gray-400">Acres</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900">{@content.boundary.acres}</p>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p class="text-xs uppercase tracking-widest text-gray-400">Perimeter</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900">{@content.boundary.perimeter}</p>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p class="text-xs uppercase tracking-widest text-gray-400">Soil moisture</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900">{@content.soil_moisture}%</p>
        </div>
      </div>

      <div class="grid gap-6 md:grid-cols-[2fr_1fr]">
        <section class="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900">Sensors</h3>
          <div class="mt-4 grid gap-3 md:grid-cols-3 sm:grid-cols-2">
            <article
              :for={sensor <- @content.sensors}
              class="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 text-sm font-semibold text-gray-800"
            >
              <p>{sensor.label}</p>
              <p class="text-xs text-gray-500">{sensor.value}</p>
              <Shared.status_pill status={status(sensor.status)} label={String.capitalize(to_string(sensor.status))} />
            </article>
          </div>
        </section>
        <section class="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900">Alerts</h3>
          <ul class="mt-4 space-y-3">
            <li
              :for={alert <- @content.alerts}
              class="flex items-start gap-3 rounded-2xl border border-gray-100/80 bg-gray-50/70 p-3"
            >
              <Shared.status_pill status={severity(alert.severity)} label={String.upcase("#{alert.severity}")} />
              <div>
                <p class="text-sm font-semibold text-gray-900">{alert.summary}</p>
                <p class="text-xs text-gray-500">{alert.code}</p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
    """
  end

  defp status(:online), do: :success
  defp status(:degraded), do: :watch
  defp status(:offline), do: :alert
  defp status(_), do: :ok

  defp severity(:high), do: :alert
  defp severity(:medium), do: :watch
  defp severity(_), do: :info
end
