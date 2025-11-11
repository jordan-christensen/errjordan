defmodule ErrjordanWeb.BentoOverviewComponents do
  @moduledoc """
  Components that render the Overview route inside Bento.
  """

  use ErrjordanWeb, :html

  alias ErrjordanWeb.BentoSharedComponents, as: Shared

  attr :content, :map, required: true
  attr :time_range, :map, required: true
  attr :mode, :string, default: "timeline"

  def render(assigns) do
    ~H"""
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-emerald-600">Bento Overview</p>
          <h1 class="text-2xl font-semibold text-gray-900">Operational pulse</h1>
          <p class="text-sm text-gray-500">
            {format_range(@time_range)} · Mode: {@mode}
          </p>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
        >
          <.icon name="hero-arrow-down-tray" class="size-4" /> Export snapshot
        </button>
      </header>

      <div class="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
        <Shared.stat_card :for={metric <- @content.metrics} {metric} />
      </div>

      <section class="rounded-3xl border border-gray-100 bg-gradient-to-b from-white to-slate-50/60 p-6 shadow-inner shadow-gray-100/70">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Irrigation Efficiency</p>
            <p class="text-2xl font-semibold text-gray-900">Flow vs demand</p>
          </div>
          <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {@content.timeline |> length()} day trend
          </span>
        </div>
        <div class="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div class="rounded-2xl bg-white p-4 shadow-sm">
            <div class="flex h-64 items-end gap-1">
              <div
                :for={entry <- @content.timeline}
                class="flex-1 rounded-full bg-gradient-to-t from-sky-200 via-sky-300 to-sky-500/90"
                style={"height: #{bar_height(entry)}%"}
                aria-label={"#{entry.date}"}
              />
            </div>
            <div class="mt-3 flex justify-between text-[11px] uppercase tracking-widest text-gray-400">
              <span>Start</span>
              <span>End</span>
            </div>
          </div>
          <div class="flex flex-col gap-4">
            <article
              :for={focus <- @content.focus_areas}
              class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div class="flex items-center justify-between">
                <p class="text-sm font-semibold text-gray-900">{focus.title}</p>
                <Shared.status_pill status={focus.status} label={String.upcase("#{focus.status}")} />
              </div>
              <p class="mt-2 text-sm text-gray-500">{focus.description}</p>
            </article>
          </div>
        </div>
      </section>

      <Shared.panel title="Narrative">
        <p class="text-sm text-gray-600">
          {@content.narrative}
        </p>
      </Shared.panel>
    </div>
    """
  end

  defp format_range(%{start: start_date, end: end_date}) do
    "#{Calendar.strftime(start_date, "%b %-d")} – #{Calendar.strftime(end_date, "%b %-d")}"
  end

  defp bar_height(entry) do
    ratio =
      case entry.demand do
        0 -> 0
        demand -> entry.irrigated / demand
      end

    ratio
    |> Kernel.*(100)
    |> Float.round(1)
  end
end
