/**
 * The entry point function. This will read the provided CSV file, scrape the companies'
 * YC pages, and output structured data in a JSON file.
 */
import * as fs from 'fs/promises';
import { CheerioCrawler } from 'crawlee';
import Papa from 'papaparse';

interface Founder {
  name: string;
  description?: string;
  links: string[];
}

interface Job {
  jobLocation: string;
  jobPay: string;
  jobEquity: string;
  jobEx: string;
  jobTitle: string;
}

interface NewsStory {
  title: string;
  link: string;
}

interface LaunchPost {
  title: string;
  links: string[];
  description: string;
}

interface Company {
  name: string;
  founded?: string;
  description?: string;
  teamSize?: string;
  jobs?: Job[];
  founders?: Founder[];
  newsStories?: NewsStory[];
  launchPosts?: LaunchPost[];
}

// Parses the CSV file and returns an array of company names and URLs
async function parseCSV(filePath: string): Promise<{ name: string, url: string }[]> {
  try {
    const csvContent = await fs.readFile(filePath, 'utf-8');

    // Parse the CSV using PapaParse library
    const { data, errors } = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

    if (errors && errors.length > 0) {
      console.error("CSV Parsing Errors:", errors);
      throw new Error("Failed to parse CSV");
    }

    // Filter out rows without Company Name or YC URL and map to the desired structure
    return (data as Array<{ "Company Name"?: string; "YC URL"?: string }>)
      .filter(row => row["Company Name"] && row["YC URL"])
      .map(row => ({ name: row["Company Name"]!, url: row["YC URL"]! }));
  } catch (error) {
    console.error("Error in parseCSV:", error);
    throw error;
  }
}

// Main function to process the company list
export async function processCompanyList(): Promise<void> {
  const companies = await parseCSV('inputs/companies.csv');
  const results: Company[] = [];
  const crawler = new CheerioCrawler({
    async requestHandler({ request, response, body, contentType, $ }) {
      // Extract the company name
      const name = $('H1').text().trim();

      // Extract the company description
      const description = $('.whitespace-pre-line').text().trim();

      // Initialize variables for team size, founded date, and location
      let teamSize: string = "";
      let founded: string = "";
      let location: string = "";

      
      // Extract team size, founded date, and location from specific elements
      $('div[class=space-y-0.5] div span').each((index, element) => {
        if (index === 1) founded = $(element).text();
        if (index === 3) teamSize = $(element).text();
        if (index === 5) location = $(element).text();
      });

      // Initialize an array to store job information
      const jobs: Job[] = [];

      // Extract job information from specific elements
      $('.divide-gray-200 .py-4').each((index, element) => {
        let jobLocation: string = "";
        let jobPay: string = "";
        let jobEquity: string = "";
        let jobEx: string = "";
        let jobTitle: string = "";

        // Extract job location, pay, equity, and experience from specific elements
        $(element).find(".justify-left .list-item").each((index, element) => {
          if (index === 0) jobLocation = $(element).text();
          if (index === 1) jobPay = $(element).text();
          if (index === 2) jobEquity = $(element).text();
          if (index === 3) jobEx = $(element).text();
        });

        // Extract job title from specific element
        jobTitle = $(element).find(".pr-4").text().trim();

        // Add the job information to the jobs array
        jobs.push({
          jobLocation,
          jobPay,
          jobEquity,
          jobEx,
          jobTitle
        });
      });

      // Initialize an array to store founder information
      const founders: Founder[] = [];

      // Extract founder information from specific elements
      $('.space-y-5 .flex').each((index, element) => {
        let name: string = "";
        let description: string = "";
        let links: string[] = [];

        // Extract founder name and description from specific elements
        $(element).find('.flex-grow').each((index, element) => {
          name = $(element).find("h3").text().trim();
          description = $(element).find("p").text().trim();
        });

        // Extract founder links from specific elements
        $(element).find('.ycdc-card').each((index, element) => {
          links = $(element).find('a[href]')
            .map((i, el) => $(el).attr('href'))
            .get();
        });

        // Add the founder information to the founders array if all fields are present
        if (name !== "" && description !== "" && links !== new Array()) {
          founders.push({ name, description, links });
        }
      });

      // Initialize an array to store launch post information
      const launchPosts: LaunchPost[] = [];

      // Extract launch post information from specific elements
      $('.company-launch').each((index, element) => {
        let title: string = $(element).find("h3").text().trim();
        let description: string = $(element).find("div").text().trim();
        let links: string[] = $(element).find('a[href]')
          .map((i, el) => `https://www.ycombinator.com${$(el).attr('href')}`)
          .get();

        // Add the launch post information to the launchPosts array if all fields are present
        if (title !== "" && description !== "" && links !== new Array()) {
          launchPosts.push({ title, description, links });
        }
      });

      // Add the extracted data to the results array
      await results.push({
        name,
        description,
        founded,
        teamSize,
        jobs,
        founders,
        launchPosts
      });
    },
  });

  // Run the crawler for each company URL
  for (const company of companies) {
    if (company.url) {
      await crawler.run([company.url]);
    }
  }

  // Write the results to a JSON file
  await fs.writeFile('out/scraped.json', JSON.stringify(results, null, 4));
}