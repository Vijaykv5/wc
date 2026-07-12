import { NextResponse } from "next/server";

type RestCountryRecord = {
  names?: {
    common?: string;
  };
  codes?: {
    alpha_2?: string;
  };
  flag?: {
    emoji?: string;
    url_svg?: string;
    url_png?: string;
  };
  region?: string;
};

type RestCountriesResponse = {
  data?: {
    objects?: RestCountryRecord[];
    meta?: {
      more?: boolean;
    };
  };
  errors?: Array<{
    message?: string;
  }>;
};

function iso2ToFlag(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";

  return String.fromCodePoint(...code.split("").map((char) => 127397 + char.charCodeAt(0)));
}

async function fetchCountryPage(offset: number, apiKey: string) {
  const params = new URLSearchParams({
    limit: "100",
    offset: String(offset),
    response_fields: "names.common,codes.alpha_2,flag.emoji,flag.url_svg,flag.url_png,region",
  });

  const response = await fetch(`https://api.restcountries.com/countries/v5?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    next: {
      revalidate: 60 * 60 * 4,
    },
  });

  const payload = (await response.json()) as RestCountriesResponse;

  if (!response.ok) {
    const message = payload.errors?.[0]?.message ?? "REST Countries request failed.";
    throw new Error(message);
  }

  return payload;
}

export async function GET() {
  const apiKey = process.env.REST_COUNTRIES_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "REST_COUNTRIES_API_KEY is not configured." }, { status: 500 });
  }

  try {
    const pages = await Promise.all([0, 100, 200].map((offset) => fetchCountryPage(offset, apiKey)));
    const countries = pages
      .flatMap((page) => page.data?.objects ?? [])
      .map((country) => {
        const code = country.codes?.alpha_2 ?? "XX";

        return {
          code,
          name: country.names?.common ?? "Unknown country",
          flag: country.flag?.emoji || iso2ToFlag(code),
          flagImage: country.flag?.url_svg ?? country.flag?.url_png ?? "",
          region: country.region ?? "Global",
        };
      })
      .filter((country) => country.name !== "Unknown country" && /^[A-Z]{2}$/.test(country.code))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ countries });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not load countries.",
      },
      { status: 502 },
    );
  }
}
