defmodule ErrjordanWeb.BentoMCComponents do
  @moduledoc """
  Components for MC-style Bento routes.
  """

  use ErrjordanWeb, :html

  alias ErrjordanWeb.BentoSharedComponents, as: Shared

  attr :route, :map, required: true
  attr :content, :map, required: true
  attr :time_range, :map, required: true

  def render(assigns) do
    ~H"""
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-indigo-600">MC Collection</p>
          <h1 class="text-2xl font-semibold text-gray-900">{@content.title}</h1>
          <p class="text-sm text-gray-500">{format_range(@time_range)}</p>
        </div>
        <Shared.status_pill status={:info} label="Realtime" />
      </header>

      <div class="grid gap-4 md:grid-cols-4 sm:grid-cols-2">
        <div
          :for={metric <- @content.metrics}
          class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <p class="text-xs uppercase tracking-widest text-gray-400">{metric.label}</p>
          <p class="mt-2 text-2xl font-semibold text-gray-900">{metric.value}</p>
        </div>
      </div>

      <Shared.panel title="Recent activity">
        <Shared.simple_list items={@content.activity} />
      </Shared.panel>

      <div class="grid gap-6 md:grid-cols-2">
        <section class="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900">Irrigation allocation</h3>
            <span class="text-xs font-semibold uppercase tracking-widest text-gray-400">Last 7d</span>
          </div>
          <div class="space-y-4">
            <div
              :for={entry <- @content.irrigation}
              class="flex items-center justify-between gap-4"
            >
              <p class="text-sm text-gray-600">{entry.label}</p>
              <div class="flex flex-1 items-center gap-2">
                <div class="h-2 flex-1 rounded-full bg-gray-100">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500"
                    style={"width: #{entry.value}%"}
                  />
                </div>
                <span class="text-xs font-semibold text-gray-500">{entry.value}%</span>
              </div>
            </div>
          </div>
        </section>
        <section class="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900">Summary</h3>
          <p class="mt-3 text-sm text-gray-600">
            {@content.summary}
          </p>
          <ul class="mt-4 space-y-2">
            <li class="flex items-center gap-2 text-xs text-gray-500">
              <.icon name="hero-check-badge" class="size-4 text-emerald-500" /> Automation in control
            </li>
            <li class="flex items-center gap-2 text-xs text-gray-500">
              <.icon name="hero-arrow-trending-up" class="size-4 text-indigo-500" /> Pumps holding steady
            </li>
            <li class="flex items-center gap-2 text-xs text-gray-500">
              <.icon name="hero-bell-alert" class="size-4 text-amber-500" /> Watch Hillside perimeter
            </li>
          </ul>
        </section>
      </div>
    </div>
    """
  end

  defp format_range(%{start: start_date, end: end_date}) do
    "#{Calendar.strftime(start_date, "%b %-d")} – #{Calendar.strftime(end_date, "%b %-d")}"
  end
end
