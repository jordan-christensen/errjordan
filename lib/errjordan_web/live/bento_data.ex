defmodule ErrjordanWeb.BentoData do
  @moduledoc """
  Collection of lightweight data builders used by `BentoLive`.

  This module purposefully keeps the data colocation close to the LiveView so we
  can evolve the fetching logic over time without introducing a larger context.
  """

  alias ErrjordanWeb.BentoRoute

  @type loader_assigns :: %{
          required(:route) => BentoRoute.t(),
          required(:time_range) => %{start: Date.t(), end: Date.t()},
          required(:mode) => String.t()
        }

  @spec load_overview(loader_assigns()) :: map()
  def load_overview(assigns) do
    %{
      metrics: overview_metrics(assigns),
      timeline: generate_timeline(assigns.time_range),
      focus_areas: focus_areas(),
      narrative:
        "Performance across MC blocks remains strong. Irrigation efficiency " <>
          "trended upward over the past 30 days while stress events were confined " <>
          "to the Hillside perimeter."
    }
  end

  @spec load_mc_view(loader_assigns()) :: map()
  def load_mc_view(assigns) do
    %{
      title: assigns.route.label,
      health_score: Enum.random(78..96),
      summary:
        "MC view aggregates telemetry across the block to highlight irrigation, " <>
          "stress, and growth anomalies for rapid triage.",
      metrics: mc_metrics(assigns.route),
      activity: activity_feed(assigns.route),
      irrigation: irrigation_breakdown(assigns.route.slug)
    }
  end

  @spec load_custom_view(loader_assigns()) :: map()
  def load_custom_view(assigns) do
    %{
      title: assigns.route.label,
      boundary: custom_boundary(assigns.route),
      soil_moisture: Enum.random(42..88),
      alerts: custom_alerts(assigns.route),
      sensors: sensor_grid(assigns.route.slug)
    }
  end

  defp overview_metrics(_assigns) do
    [
      %{id: :yield, label: "Projected Yield", value: "4.2m lbs", change: +2.6},
      %{id: :irrigation, label: "Irrigation Efficiency", value: "93%", change: +4.1},
      %{id: :stress_events, label: "Stress Events", value: "8", change: -3.0},
      %{id: :canopy, label: "Canopy Growth", value: "+18cm", change: +1.8}
    ]
  end

  defp focus_areas do
    [
      %{
        id: :north_creek,
        title: "North Creek",
        status: :watch,
        description: "Leaf temp delta pushed beyond the comfort band for 6 hrs."
      },
      %{
        id: :orchard_12,
        title: "Orchard 12",
        status: :ok,
        description: "Nutrient application completed, growth trend normalized."
      },
      %{
        id: :lower_block,
        title: "Lower Block",
        status: :alert,
        description: "Moisture dropped under 28% VWC, schedule a flush cycle."
      }
    ]
  end

  defp mc_metrics(route) do
    [
      %{label: "Avg Moisture", value: "#{Enum.random(37..52)}%"},
      %{label: "Peak Temp", value: "#{Enum.random(92..102)}°F"},
      %{label: "ETc Deviation", value: "-#{Enum.random(1..5)}%"},
      %{label: "Pump Runtime", value: "#{Enum.random(18..28)} hrs"}
    ]
    |> Enum.map(&Map.put(&1, :id, :"#{route.slug}-#{&1.label}"))
  end

  defp activity_feed(route) do
    [
      %{
        id: "#{route.slug}-flush",
        title: "Flush cycle queued",
        timestamp: format_timestamp(-6 * 60 * 60),
        author: "Automation",
        detail: "Based on low-pressure anomaly on lateral 4A."
      },
      %{
        id: "#{route.slug}-sampling",
        title: "Tissue samples",
        timestamp: format_timestamp(-18 * 60 * 60),
        author: "Field Ops",
        detail: "Sent to lab for macro analysis."
      },
      %{
        id: "#{route.slug}-drone",
        title: "Drone sweep",
        timestamp: format_timestamp(-24 * 60 * 60),
        author: "Aerial",
        detail: "NDVI map shows emerging cool spots near south fence."
      }
    ]
  end

  defp irrigation_breakdown(slug) do
    [
      %{label: "North Loop", value: 42},
      %{label: "Central Loop", value: 35},
      %{label: "South Loop", value: 23}
    ]
    |> Enum.map(fn entry -> Map.put(entry, :id, "#{slug}-#{entry.label}") end)
  end

  defp custom_boundary(route) do
    %{
      acres: Enum.random(42..110),
      perimeter: "#{Enum.random(6..11)}.#{Enum.random(1..9)} km",
      geojson: %{type: "Polygon", coordinates: []},
      highlight: "#{route.label} blends permanent and block plantings."
    }
  end

  defp custom_alerts(route) do
    [
      %{severity: :medium, summary: "Wind stress overnight", code: "#{route.slug}-wind"},
      %{severity: :low, summary: "Fertigation due in 3 days", code: "#{route.slug}-fert"},
      %{severity: :high, summary: "Moisture sensor offline", code: "#{route.slug}-sensor"}
    ]
  end

  defp sensor_grid(slug) do
    Enum.map(1..6, fn index ->
      %{
        id: "#{slug}-sensor-#{index}",
        label: "Sensor #{index}",
        status: Enum.random([:online, :degraded, :offline]),
        value: "#{Enum.random(28..55)}% VWC"
      }
    end)
  end

  defp generate_timeline(%{start: start_date, end: end_date}) do
    days = Date.diff(end_date, start_date)

    for offset <- 0..days do
      date = Date.add(start_date, offset)

      %{
        date: date,
        irrigated: Enum.random(50..110),
        demand: Enum.random(60..120)
      }
    end
  end

  defp format_timestamp(delta_seconds) do
    DateTime.utc_now()
    |> DateTime.add(delta_seconds, :second)
    |> Calendar.strftime("%b %-d • %H:%M")
  end
end
