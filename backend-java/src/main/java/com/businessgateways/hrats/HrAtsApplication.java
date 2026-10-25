package com.businessgateways.hrats;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * HR ATS — Job Requirement Board and Applicant Tracking System.
 *
 * Runs against the existing hr_ats_db schema. Hibernate is configured
 * with ddl-auto=validate so it verifies the mapping at startup and
 * never alters a table.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
@EnableAsync
public class HrAtsApplication {

    public static void main(String[] args) {
        SpringApplication.run(HrAtsApplication.class, args);
    }
}
